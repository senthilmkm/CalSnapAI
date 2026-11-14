const assert = require('assert');
const { test } = require('node:test');
const {
  MODEL_NAME,
  ANALYSIS_BUDGET_MS,
  buildMealPrompt,
  generationConfig,
  withDeadline,
  analyzeMealPhoto,
} = require('../backend/analyzeMeal/analysis');
const {
  dayKey,
  dailySnapLimit,
  canUseDailySnap,
  recordDailySnap,
} = require('../backend/analyzeMeal/quota');
const { analyzeMeal, resetQuotaForTests, setGeminiFactoryForTests, defaultGeminiFactory, analysisErrorMessage } = require('../backend/analyzeMeal/index');
const { interpretMealResponse, SNAP_WAIT_MS } = require('../services/mealRead');

const mealJson = JSON.stringify({
  dish_name: 'Rice and dal',
  items: [{ name: 'Rice', weight_g: 150, calories: 200, protein_g: 4, carbs_g: 44, fat_g: 0.5 }],
  estimated_oil_g: 5,
  total_calories: 200,
  total_protein_g: 4,
  total_carbs_g: 44,
  total_fat_g: 0.5,
  glucose_impact_score: 'MEDIUM',
  energy_crash_risk: 'LOW',
  ai_tip: 'Add yogurt for a steadier afternoon.',
});

function goodResponse(extra = {}) {
  return { text: mealJson, candidates: [{ finishReason: 'STOP', ...extra }] };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

function request(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer test',
      'x-calsnap-app-secret': 'secret',
      'x-app-user-id': 'user-1',
      'x-is-pro': 'false',
    },
    body: {
      image_base64: 'data:image/jpeg;base64,abc',
      voice_transcript: 'extra ghee!',
      cultural_preset: 'South Indian',
    },
    ...overrides,
  };
}

test('meal prompt and generation config keep the fields a snap shows', () => {
  const prompt = buildMealPrompt('  dal  ', '  Tamil  ');
  assert.match(prompt, /Voice note: "dal"/);
  assert.match(prompt, /Cuisine: "Tamil"/);
  assert.match(prompt, /glucose_impact_score/);
  assert.match(prompt, /ai_tip/);
  assert.match(buildMealPrompt('   ', ''), /Voice note: "None"/);
  assert.match(buildMealPrompt('   ', ''), /Cuisine: "Standard"/);
  assert.match(buildMealPrompt(null, null), /Cuisine: "Standard"/);

  const config = generationConfig({ type: 'object' });
  assert.equal(config.thinkingConfig.thinkingBudget, 0);
  assert.equal(config.maxOutputTokens, 2048);
  assert.equal(config.responseSchema.type, 'object');
  assert.equal(MODEL_NAME, 'gemini-3.5-flash-lite');
  assert.equal(ANALYSIS_BUDGET_MS, 18000);
});

test('analysis accepts the first complete meal and retries a bad reply once', async () => {
  let calls = 0;
  const meal = await analyzeMealPhoto({
    budgetMs: 5000,
    now: () => 0,
    contents: ['prompt'],
    config: {},
    generate: async () => {
      calls += 1;
      if (calls === 1) return { text: '', candidates: [] };
      return goodResponse();
    },
    parse: JSON.parse,
    repair: (value) => value,
    isImplausible: () => false,
  });
  assert.equal(meal.dish_name, 'Rice and dal');
  assert.equal(calls, 2);

  calls = 0;
  const retried = await analyzeMealPhoto({
    budgetMs: 5000,
    now: () => 1000,
    contents: ['prompt'],
    config: {},
    generate: async () => {
      calls += 1;
      if (calls === 1) return { text: '{}', candidates: [{ finishReason: 'MAX_TOKENS' }] };
      return { text: '{}', candidates: [{ finishReason: 'STOP' }] };
    },
    parse: () => ({ total_calories: calls === 1 ? 1 : 80 }),
    repair: (value) => value,
    isImplausible: (value) => value.total_calories < 20,
  });
  assert.equal(retried.total_calories, 80);

  calls = 0;
  const repaired = await analyzeMealPhoto({
    budgetMs: 5000,
    now: () => 0,
    generate: async () => {
      calls += 1;
      return { text: '{}', candidates: [{ finishReason: 'STOP' }] };
    },
    parse: () => ({ total_calories: calls === 1 ? 1 : 90 }),
    repair: (value) => value,
    isImplausible: (value) => value.total_calories < 20,
  });
  assert.equal(repaired.total_calories, 90);

  let plainCalls = 0;
  const plain = await analyzeMealPhoto({
    generate: async () => {
      plainCalls += 1;
      if (plainCalls === 1) return { text: null };
      return { text: mealJson };
    },
    parse: JSON.parse,
    repair: (value) => value,
    isImplausible: () => false,
  });
  assert.equal(plain.dish_name, 'Rice and dal');

  await assert.rejects(
    () => analyzeMealPhoto({
      budgetMs: 5000,
      now: () => 0,
      maxAttempts: 0,
      generate: async () => goodResponse(),
      parse: JSON.parse,
      repair: (value) => value,
      isImplausible: () => false,
    }),
    /Meal analysis failed/
  );
});

test('analysis retries a thrown parse and stops when time runs out', async () => {
  let calls = 0;
  const meal = await analyzeMealPhoto({
    budgetMs: 5000,
    now: () => 0,
    generate: async () => {
      calls += 1;
      if (calls === 1) throw new Error('parse later');
      return goodResponse();
    },
    parse: () => {
      if (calls === 1) throw new Error('bad json');
      return { dish_name: 'Rice and dal' };
    },
    repair: (value) => value,
    isImplausible: () => false,
  });
  assert.equal(meal.dish_name, 'Rice and dal');

  await assert.rejects(
    () => analyzeMealPhoto({
      budgetMs: 500,
      now: () => 0,
      generate: async () => goodResponse(),
      parse: JSON.parse,
      repair: (value) => value,
      isImplausible: () => false,
    }),
    (error) => error.code === 'ANALYSIS_TIMEOUT'
  );

  await assert.rejects(
    () => analyzeMealPhoto({
      budgetMs: 5000,
      now: () => 0,
      generate: async () => {
        const error = new Error('Meal analysis timed out');
        error.code = 'ANALYSIS_TIMEOUT';
        throw error;
      },
      parse: JSON.parse,
      repair: (value) => value,
      isImplausible: () => false,
    }),
    (error) => error.code === 'ANALYSIS_TIMEOUT'
  );

  await assert.rejects(
    () => analyzeMealPhoto({
      budgetMs: 5000,
      now: () => 0,
      generate: async () => {
        throw '';
      },
      parse: JSON.parse,
      repair: (value) => value,
      isImplausible: () => false,
    }),
    /Meal analysis failed/
  );

  await assert.rejects(
    () => withDeadline(new Promise(() => {}), 20),
    (error) => error.code === 'ANALYSIS_TIMEOUT'
  );
  const fast = await withDeadline('ready', 50);
  assert.equal(fast, 'ready');
});

test('daily snap quota is counted only after a real meal', () => {
  const map = new Map();
  const now = new Date('2026-11-14T01:00:00Z');
  assert.equal(dayKey(now), '2026-11-14');
  assert.equal(dailySnapLimit('no'), 1);
  assert.equal(dailySnapLimit(0), 1);
  assert.equal(dailySnapLimit('2'), 2);
  assert.equal(canUseDailySnap(map, 'user', true, now, 1), true);
  assert.equal(canUseDailySnap(map, 'user', false, now, 1), true);
  recordDailySnap(map, 'user', true, now);
  assert.equal(map.size, 0);
  recordDailySnap(map, 'user', false, now);
  assert.equal(canUseDailySnap(map, 'user', false, now, 1), false);
  map.set('user:2026-11-13', 1);
  recordDailySnap(map, 'other', false, now, 1);
  assert.equal(map.has('user:2026-11-13'), false);
  assert.equal(map.get('other:2026-11-14'), 1);
});

test('analyzeMeal returns a real meal and does not spend a failed snap', async () => {
  const previousSecret = process.env.APP_SECRET;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousLimit = process.env.FREE_DAILY_SNAP_LIMIT;
  process.env.APP_SECRET = 'secret';
  process.env.GEMINI_API_KEY = 'key';
  process.env.FREE_DAILY_SNAP_LIMIT = '1';
  resetQuotaForTests();

  const options = mockRes();
  await analyzeMeal({ method: 'OPTIONS', headers: {} }, options);
  assert.equal(options.statusCode, 204);

  const wrongMethod = mockRes();
  await analyzeMeal({ method: 'GET', headers: {} }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);

  const forbidden = mockRes();
  await analyzeMeal(request({ headers: { ...request().headers, 'x-calsnap-app-secret': 'nope' } }), forbidden);
  assert.equal(forbidden.statusCode, 403);

  const unauthorized = mockRes();
  await analyzeMeal(request({
    headers: { ...request().headers, authorization: 'Token nope' },
  }), unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const missingAuth = mockRes();
  await analyzeMeal({
    method: 'POST',
    headers: { 'x-calsnap-app-secret': 'secret' },
  }, missingAuth);
  assert.equal(missingAuth.statusCode, 401);

  const missingBody = mockRes();
  await analyzeMeal({
    method: 'POST',
    headers: { authorization: 'Bearer test', 'x-calsnap-app-secret': 'secret' },
  }, missingBody);
  assert.equal(missingBody.statusCode, 400);

  const badImage = mockRes();
  await analyzeMeal(request({ body: { image_base64: 12 } }), badImage);
  assert.equal(badImage.statusCode, 400);

  const tooLarge = mockRes();
  await analyzeMeal(request({ body: { image_base64: 'x'.repeat(10 * 1024 * 1024 + 1) } }), tooLarge);
  assert.equal(tooLarge.statusCode, 413);

  delete process.env.GEMINI_API_KEY;
  const missingKey = mockRes();
  await analyzeMeal(request(), missingKey);
  assert.equal(missingKey.statusCode, 500);
  process.env.GEMINI_API_KEY = 'key';

  let seenImage = '';
  analyzeMeal.generate = async (_apiKey, generateRequest) => {
    seenImage = generateRequest.contents[1].inlineData.data;
    assert.ok(String(generateRequest.contents[0]).includes('extra ghee'));
    assert.equal(generateRequest.model, 'gemini-3.5-flash-lite');
    return goodResponse();
  };
  const success = mockRes();
  await analyzeMeal(request(), success);
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.data.dish_name, 'Rice and dal');
  assert.equal(seenImage, 'abc');

  const blocked = mockRes();
  await analyzeMeal(request(), blocked);
  assert.equal(blocked.statusCode, 429);

  analyzeMeal.generate = async () => {
    throw null;
  };
  const failed = mockRes();
  await analyzeMeal(request({
    headers: { ...request().headers, 'x-app-user-id': 'user-2', 'x-is-pro': 'true' },
  }), failed);
  assert.equal(failed.statusCode, 500);

  analyzeMeal.generate = async () => goodResponse();
  const pro = mockRes();
  await analyzeMeal(request({
    headers: { ...request().headers, 'x-app-user-id': 'user-2', 'x-is-pro': 'true' },
    body: { image_base64: 'abc', is_pro: true },
  }), pro);
  assert.equal(pro.statusCode, 200);
  const proAgain = mockRes();
  await analyzeMeal(request({
    headers: { ...request().headers, 'x-app-user-id': 'user-2', 'x-is-pro': 'true' },
    body: { image_base64: 'abc' },
  }), proAgain);
  assert.equal(proAgain.statusCode, 200);

  delete process.env.APP_SECRET;
  const openSecret = mockRes();
  await analyzeMeal(request({
    headers: { authorization: 'Bearer test' },
    body: { image_base64: 'abc', user_id: 'guest-from-body', voice_transcript: 5, cultural_preset: '   ', is_pro: true },
  }), openSecret);
  assert.equal(openSecret.statusCode, 200);

  setGeminiFactoryForTests(() => ({
    models: {
      generateContent: async () => goodResponse(),
    },
  }));
  analyzeMeal.generate = null;
  const direct = mockRes();
  await analyzeMeal(request({
    headers: { authorization: 'Bearer test', 'x-app-user-id': 'direct-user' },
    body: { image_base64: 'abc' },
  }), direct);
  assert.equal(direct.statusCode, 200);
  assert.ok(defaultGeminiFactory('test-key'));

  const guest = mockRes();
  await analyzeMeal(request({
    headers: { authorization: 'Bearer test' },
    body: { image_base64: 'abc' },
  }), guest);
  assert.equal(guest.statusCode, 200);

  analyzeMeal.generate = async () => {
    throw new Error('');
  };
  const blank = mockRes();
  await analyzeMeal(request({
    headers: { authorization: 'Bearer test', 'x-app-user-id': 'blank-user' },
    body: { image_base64: 'abc' },
  }), blank);
  assert.equal(blank.statusCode, 500);
  assert.match(blank.body.message, /internal server error/i);
  assert.equal(analysisErrorMessage(null), 'An internal server error occurred while processing nutrition analysis.');
  assert.equal(analysisErrorMessage(new Error('')), 'An internal server error occurred while processing nutrition analysis.');
  assert.equal(analysisErrorMessage(new Error('model down')), 'model down');

  resetQuotaForTests();
  if (previousSecret === undefined) delete process.env.APP_SECRET;
  else process.env.APP_SECRET = previousSecret;
  if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousKey;
  if (previousLimit === undefined) delete process.env.FREE_DAILY_SNAP_LIMIT;
  else process.env.FREE_DAILY_SNAP_LIMIT = previousLimit;
});

test('the phone treats only a real meal as success', () => {
  assert.equal(SNAP_WAIT_MS, 20000);
  assert.equal(interpretMealResponse(429, null).type, 'quota');
  assert.equal(interpretMealResponse(200, { success: true, data: { dish_name: 'Rice' } }).type, 'meal');
  assert.equal(interpretMealResponse(200, { success: false }).type, 'retry');
  assert.equal(interpretMealResponse(500, null).type, 'retry');
  assert.equal(interpretMealResponse(200, null).type, 'retry');
});
