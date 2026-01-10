import { SuggestedAction } from '@/contexts/SessionContext';

/**
 * Calculate completion percentage for a questionnaire-based action
 */
export function calculateCompletionPercentage(action: SuggestedAction, questionnaireDef?: any): number {
  // If scheduling, always 100% if essential fields exist
  if (action.type === 'scheduling') return 100;

  // If action has a QuestionnaireResponse, calculate based on filled items
  if (action.fhirPreview?.resourceType === 'QuestionnaireResponse' && action.fhirPreview?.item && Array.isArray(action.fhirPreview.item)) {
    const items = action.fhirPreview.item as any[];
    
    // ALWAYS count ALL fields, not just required ones (since Medplum questionnaires don't mark fields as required)
    let totalFields = 0;
    let filledFields = 0;
    
    const countAllFields = (itemList: any[]) => {
      for (const item of itemList) {
        if (item.item && Array.isArray(item.item)) {
          // Recurse into groups
          countAllFields(item.item);
        } else if (item.linkId && !item.linkId.includes('display') && !item.linkId.includes('section')) {
          // Count this as a field (exclude display-only and section headers)
          totalFields += 1;
          
          const answerValue = item.answer && item.answer.length > 0 ? item.answer[0] : null;
          
          if (answerValue) {
            const hasValue = 
              (answerValue.valueString && answerValue.valueString.trim() !== '' && answerValue.valueString !== 'N/A' && answerValue.valueString !== 'Unknown' && answerValue.valueString !== 'Select an option...' && answerValue.valueString !== 'Select an option') ||
              (answerValue.valueBoolean !== undefined && answerValue.valueBoolean !== null) ||
              (answerValue.valueInteger !== undefined && answerValue.valueInteger !== null && !isNaN(answerValue.valueInteger)) ||
              (answerValue.valueDecimal !== undefined && answerValue.valueDecimal !== null && !isNaN(answerValue.valueDecimal)) ||
              (answerValue.valueDate && answerValue.valueDate !== '') ||
              (answerValue.valueDateTime && answerValue.valueDateTime !== '') ||
              (answerValue.valueCoding && answerValue.valueCoding.code && answerValue.valueCoding.code !== '' && answerValue.valueCoding.display && answerValue.valueCoding.display !== 'Select an option...' && answerValue.valueCoding.display !== 'Select an option');
            
            console.log(`[Completion] Field "${item.linkId}": ${hasValue ? 'FILLED' : 'EMPTY'}`, answerValue);
            
            if (hasValue) {
              filledFields += 1;
            }
          } else {
            console.log(`[Completion] Field "${item.linkId}": EMPTY (no answer)`);
          }
        }
      }
    };
    
    countAllFields(items);
    
    console.log(`[Completion] Action: ${action.title}, Total fields: ${totalFields}, Filled: ${filledFields}`);
    
    if (totalFields === 0) return 0; // If no fields at all, show 0%
    return Math.round((filledFields / totalFields) * 100);
  }

  // Fallback to basic field checking for non-questionnaire actions
  const fields = [
    action.title,
    action.details,
    action.rationale,
    action.doseInfo,
    action.pharmacy,
    action.safetyFlag,
  ];
  const filledFields = fields.filter(f => f && f !== "").length;
  return Math.round((filledFields / fields.length) * 100);
}
