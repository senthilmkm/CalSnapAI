import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { MealRecord, UserGoals } from '../types/nutrition';

/**
 * Sanitizes raw string input to prevent HTML injection vulnerabilities in PDF templates.
 */
function escapeHtml(unsafeStr: string): string {
  if (!unsafeStr) return '';
  return unsafeStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function exportNutritionPDFReport(meals: MealRecord[], goals: UserGoals): Promise<void> {
  try {
    const totalCals = meals.reduce((acc, m) => acc + (Number(m.total_calories) || 0), 0);
    const totalProtein = meals.reduce((acc, m) => acc + (Number(m.total_protein_g) || 0), 0);
    const avgCals = meals.length ? Math.round(totalCals / meals.length) : 0;
    const avgProtein = meals.length ? Math.round(totalProtein / meals.length) : 0;

    const mealRowsHtml = meals
      .map(
        (m) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${escapeHtml(new Date(m.timestamp).toLocaleDateString())} ${escapeHtml(new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;"><strong>${escapeHtml(m.dish_name)}</strong><br><span style="color: #64748B; font-size: 12px;">${escapeHtml(m.meal_type)}</span></td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #6366F1; font-weight: bold;">${m.total_calories} kcal</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${m.total_protein_g}g</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${m.total_carbs_g}g</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${m.total_fat_g}g</td>
        <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${m.estimated_oil_g}g</td>
      </tr>
    `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CalSnap AI Nutrition Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 30px; color: #0F172A; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366F1; padding-bottom: 15px; margin-bottom: 25px; }
            .title { font-size: 24px; font-weight: bold; color: #4338CA; }
            .subtitle { font-size: 14px; color: #64748B; margin-top: 4px; }
            .summary-box { display: flex; justify-content: space-between; background-color: #F8FAFC; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #E2E8F0; }
            .stat-card { text-align: center; }
            .stat-value { font-size: 20px; font-weight: bold; color: #0F172A; }
            .stat-label { font-size: 12px; color: #64748B; text-transform: uppercase; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #EEF2FF; color: #3730A3; padding: 12px 10px; text-align: left; font-size: 13px; font-weight: 600; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">CalSnap AI - Nutrition &amp; Health Report</div>
              <div class="subtitle">Generated on ${escapeHtml(new Date().toLocaleDateString())} | Confidential User Summary</div>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #6366F1;">CalSnap AI</div>
          </div>

          <div class="summary-box">
            <div class="stat-card">
              <div class="stat-value">${meals.length}</div>
              <div class="stat-label">Meals Logged</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${avgCals} kcal</div>
              <div class="stat-label">Avg Daily Calories</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${avgProtein}g</div>
              <div class="stat-label">Avg Daily Protein</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${goals.daily_calories} kcal</div>
              <div class="stat-label">Daily Target</div>
            </div>
          </div>

          <h3 style="color: #334155; margin-bottom: 15px;">Meal Log History</h3>
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Dish &amp; Meal</th>
                <th style="text-align: center;">Calories</th>
                <th style="text-align: center;">Protein</th>
                <th style="text-align: center;">Carbs</th>
                <th style="text-align: center;">Fat</th>
                <th style="text-align: center;">Oil (g)</th>
              </tr>
            </thead>
            <tbody>
              ${mealRowsHtml || '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94A3B8;">No meals logged yet.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Report generated securely by CalSnap AI. Confidential health document.
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Export CalSnap AI Nutrition PDF Report',
      });
    }
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw new Error('Failed to generate PDF report.');
  }
}

export async function exportNutritionCSVReport(meals: MealRecord[]): Promise<void> {
  try {
    const headers = 'Date,Time,Meal Type,Dish Name,Calories,Protein(g),Carbs(g),Fat(g),Oil(g),Glucose Impact\n';
    const rows = meals
      .map((m) => {
        const dateStr = new Date(m.timestamp).toLocaleDateString();
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const cleanDish = (m.dish_name || '').replace(/"/g, '""');
        return `"${dateStr}","${timeStr}","${m.meal_type}","${cleanDish}",${m.total_calories},${m.total_protein_g},${m.total_carbs_g},${m.total_fat_g},${m.estimated_oil_g},"${m.glucose_impact_score}"`;
      })
      .join('\n');

    const csvContent = headers + rows;

    // Use expo-file-system v57 new File/Paths API to write a real .csv text file
    const fileName = `CalSnap_Nutrition_${new Date().toISOString().split('T')[0]}.csv`;
    const csvFile = new File(Paths.cache, fileName);
    csvFile.write(csvContent);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(csvFile.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CalSnap AI CSV Health Data',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (error) {
    console.error('CSV Export Error:', error);
    throw new Error('Failed to generate CSV export.');
  }
}
