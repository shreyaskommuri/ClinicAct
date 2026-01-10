# Implementation Summary - Dynamic Questionnaire System

## What Changed

### ✅ Completed
1. **Created `/app/api/questionnaires/route.ts`**
   - Lists all available questionnaires from Medplum
   - Categorizes by type (medication, lab, imaging, referral, etc.)

2. **Created `/app/api/questionnaire/[id]/route.ts`**
   - Fetches a specific questionnaire with full FHIR structure
   - Returns all questions/items for rendering

3. **Created `/components/QuestionnaireForm.tsx`**
   - Dynamic form renderer that reads FHIR Questionnaire structure
   - Supports 8+ question types (string, text, boolean, choice, date, etc.)
   - Tracks user responses
   - Read-only and editable modes

4. **Updated `/app/api/analyze/route.ts`**
   - Fetches questionnaires before calling Claude
   - Injects available questionnaires into AI prompt
   - Updated SYSTEM_PROMPT with strict rules to only use provided questionnaires
   - Added `questionnaireId` and `questionnaireName` to response interface

5. **Updated `/contexts/SessionContext.tsx`**
   - Added `questionnaireId` and `questionnaireName` to `SuggestedAction` interface
   - Maps these fields from API response to frontend actions

6. **Updated `/components/ActionCard.tsx`**
   - Uses `QuestionnaireForm` component when `questionnaireId` exists
   - Shows "Using form: {questionnaireName}" indicator
   - Both inline view and modal use dynamic questionnaire
   - Falls back to hardcoded forms only if no questionnaire

## How It Works Now

### Before (Hardcoded):
```tsx
{action.type === 'lab' && (
  <FormField label="Test Name" value="CBC" />
  <FormField label="Priority" value="Routine" />
  // ... hardcoded fields
)}
```

### After (Dynamic):
```tsx
{action.questionnaireId ? (
  <QuestionnaireForm 
    questionnaireId={action.questionnaireId}
    isEditable={true}
    onResponseChange={(responses) => handleSave(responses)}
  />
) : (
  // Fallback to hardcoded only if no questionnaire
)}
```

## Data Flow

1. **User enters transcript** → clicks "Analyze"

2. **Analyze API**:
   - Fetches all questionnaires from Medplum
   - Sends to Claude: "These are the available forms: BloodTestOrderForm, MRIOrderForm, ..."
   - Claude picks closest match from list
   - Returns action with `questionnaireId: "abc-123"` and `questionnaireName: "BloodTestOrderForm"`

3. **Frontend receives action**:
   - SessionContext maps questionnaireId/Name to action
   - ActionCard displays "Using form: BloodTestOrderForm"

4. **User clicks "View Form"**:
   - QuestionnaireForm fetches full questionnaire structure from `/api/questionnaire/abc-123`
   - Renders actual questions from Medplum (not hardcoded!)
   - Example: "Type of blood test: [CBC | BMP | Lipid Panel]"

5. **User clicks "Edit Form"**:
   - Modal opens with QuestionnaireForm in editable mode
   - User fills out real questionnaire questions
   - Responses tracked: `{"test-type": "CBC", "priority": "stat"}`

6. **User approves and applies**:
   - Execute API creates QuestionnaireResponse in Medplum
   - Links to the actual Questionnaire resource
   - Doctor sees filled-out form in Medplum

## Key Benefits

✅ **No Hardcoded Forms**: Questions come from actual Medplum questionnaires
✅ **AI Validation**: Claude only suggests forms that exist
✅ **Dynamic**: Add new questionnaires in Medplum, they appear automatically
✅ **Type Safe**: Full TypeScript support with FHIR types
✅ **Flexible**: Supports 8+ question types from FHIR spec
✅ **Fallback**: Old hardcoded forms still work if no questionnaire specified

## Testing

```bash
# 1. List all questionnaires
curl http://localhost:3001/api/questionnaires

# 2. Get specific questionnaire
curl http://localhost:3001/api/questionnaire/your-questionnaire-id

# 3. Analyze transcript
# - Should return actions with questionnaireId and questionnaireName
# - Check console logs to see Claude's prompt includes questionnaire list

# 4. View form
# - Click "View Form" on an action
# - Should see actual questions from Medplum questionnaire
# - Not hardcoded generic fields

# 5. Edit form
# - Click "Edit Form"
# - Modal should show questionnaire questions
# - Fill out and save
```

## Next Steps

- [ ] Save questionnaire responses to QuestionnaireResponse resource
- [ ] Update execute endpoint to create QuestionnaireResponse
- [ ] Pre-fill questionnaire with AI-extracted values
- [ ] Add validation rules from questionnaire (required fields, etc.)
- [ ] Cache questionnaires to reduce API calls
- [ ] Add questionnaire preview tooltip
