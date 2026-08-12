import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface MacroRingProps {
  currentCalories: number;
  targetCalories: number;
  proteinG: number;
  targetProteinG: number;
  carbsG: number;
  targetCarbsG: number;
  fatG: number;
  targetFatG: number;
}

export const MacroRing: React.FC<MacroRingProps> = ({
  currentCalories,
  targetCalories,
  proteinG,
  targetProteinG,
  carbsG,
  targetCarbsG,
  fatG,
  targetFatG,
}) => {
  const size = 220;
  const strokeWidth = 12;
  const center = size / 2;

  // Ring Radii (Outer = Calories, Middle = Protein, Inner = Carbs)
  const radiusCal = center - strokeWidth - 2;
  const radiusProtein = radiusCal - strokeWidth - 6;
  const radiusCarbs = radiusProtein - strokeWidth - 6;

  const circCal = 2 * Math.PI * radiusCal;
  const circProtein = 2 * Math.PI * radiusProtein;
  const circCarbs = 2 * Math.PI * radiusCarbs;

  const safeTargetCal = Math.max(1, targetCalories || 2000);
  const safeCurrentCal = Math.max(0, currentCalories || 0);
  const progressCal = Math.min(1, Math.max(0, safeCurrentCal / safeTargetCal));

  const safeTargetProtein = Math.max(1, targetProteinG || 140);
  const safeCurrentProtein = Math.max(0, proteinG || 0);
  const progressProtein = Math.min(1, Math.max(0, safeCurrentProtein / safeTargetProtein));

  const safeTargetCarbs = Math.max(1, targetCarbsG || 200);
  const safeCurrentCarbs = Math.max(0, carbsG || 0);
  const progressCarbs = Math.min(1, Math.max(0, safeCurrentCarbs / safeTargetCarbs));

  const strokeDashoffsetCal = circCal * (1 - progressCal);
  const strokeDashoffsetProtein = circProtein * (1 - progressProtein);
  const strokeDashoffsetCarbs = circCarbs * (1 - progressCarbs);

  const isOverGoal = safeCurrentCal > safeTargetCal;
  const diffCals = Math.abs(safeTargetCal - safeCurrentCal);

  // Macro Caloric Percentages Calculation (Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g)
  const proteinCals = safeCurrentProtein * 4;
  const carbsCals = safeCurrentCarbs * 4;
  const fatCals = Math.max(0, fatG || 0) * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  const pPct = totalMacroCals > 0 ? Math.round((proteinCals / totalMacroCals) * 100) : 33;
  const cPct = totalMacroCals > 0 ? Math.round((carbsCals / totalMacroCals) * 100) : 33;
  const fPct = totalMacroCals > 0 ? Math.max(0, 100 - pPct - cPct) : 34;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Outer Ring: Calories (Indigo) */}
        <Circle
          cx={center}
          cy={center}
          r={radiusCal}
          stroke={isOverGoal ? '#FEE2E2' : '#E0E7FF'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radiusCal}
          stroke={isOverGoal ? '#EF4444' : '#4F46E5'}
          strokeWidth={strokeWidth}
          strokeDasharray={circCal}
          strokeDashoffset={strokeDashoffsetCal}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Middle Ring: Protein (Emerald Green) */}
        <Circle
          cx={center}
          cy={center}
          r={radiusProtein}
          stroke="#D1FAE5"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radiusProtein}
          stroke="#10B981"
          strokeWidth={strokeWidth}
          strokeDasharray={circProtein}
          strokeDashoffset={strokeDashoffsetProtein}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Inner Ring: Carbs (Amber Gold) */}
        <Circle
          cx={center}
          cy={center}
          r={radiusCarbs}
          stroke="#FEF3C7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radiusCarbs}
          stroke="#F59E0B"
          strokeWidth={strokeWidth}
          strokeDasharray={circCarbs}
          strokeDashoffset={strokeDashoffsetCarbs}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      {/* Clean & Spacious Inner Center Content */}
      <View style={styles.centerTextContainer}>
        <Text style={[styles.calorieNumber, isOverGoal && { color: '#EF4444' }]}>
          {isOverGoal ? `+${diffCals}` : diffCals}
        </Text>
        <Text style={[styles.calorieLabel, isOverGoal && { color: '#EF4444', fontWeight: '800' }]}>
          {isOverGoal ? 'kcal over' : 'kcal left'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNumber: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 34,
  },
  calorieLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
    letterSpacing: 0.5,
  },
});
