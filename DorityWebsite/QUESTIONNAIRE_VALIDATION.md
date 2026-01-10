# Dynamic Questionnaire System

## Problem
The AI was generating clinical actions with questionnaire forms that didn't exist in the Medplum instance, and forms were hardcoded in the frontend instead of using actual Medplum questionnaires.

## Solution Overview
Implemented a fully dynamic questionnaire system that:
1. Fetches all available questionnaires from Medplum in real-time
2. Provides this list to Claude AI during transcript analysis
3. Instructs Claude to only use questionnaires from the provided list
4. Fetches and renders the actual questionnaire structure from Medplum
5. Displays real questions from the specific Medplum questionnaire
6. Allows filling out those exact questions (not hardcoded forms)

## Files Modified

### 1. `/app/api/questionnaires/route.ts` (NEW)
**Purpose:** Fetch all available questionnaires from Medplum

**Key Features:**
- GET endpoint that queries Medplum for active Questionnaires
- `categorizeQuestionnaire()` helper function that maps questionnaires to types based on keywords in name/title/description
- Returns simplified format: `{id, name, title, description, code, type}`
- Supports types: medication, lab, imaging, referral, assessment, other

**Example Response:**
```json
{
  "questionnaires": [
    {
      "id": "450c56bf-48fd-43c7-a01a-89685423b59d",
      "name": "BloodTestOrderForm",
      "title": "Blood Test Order",
      "description": "Form for ordering blood tests",
      "type": "lab"
    }
  ]
}
```

### 2. `/app/api/questionnaire/[id]/route.ts` (NEW)
**Purpose:** Fetch a specific Questionnaire from Medplum by ID

**Key Features:**
- Dynamic route that accepts questionnaire ID
- Returns full FHIR Questionnaire resource with all items (questions)
- Includes question structure, types, options, validation rules
- Used by frontend to render actual form questions

**Example Response:**
```json
{
  "questionnaire": {
    "resourceType": "Questionnaire",
    "id": "450c56bf-48fd-43c7-a01a-89685423b59d",
    "name": "BloodTestOrderForm",
    "title": "Blood Test Order",
    "item": [
      {
        "linkId": "test-type",
        "text": "Type of blood test",
        "type": "choice",
        "required": true,
        "answerOption": [
          {"valueCoding": {"code": "CBC", "display": "Complete Blood Count"}},
          {"valueCoding": {"code": "BMP", "display": "Basic Metabolic Panel"}}
        ]
      }
    ]
  }
}
```

### 2. `/app/api/analyze/route.ts` (UPDATED)
**Purpose:** Analyze clinical transcripts using Claude AI

**Key Changes:**
1. **Fetch Questionnaires:** Before calling Claude, fetches available questionnaires from the `/api/questionnaires` endpoint
2. **Build Context:** Creates a `questionnaireContext` string listing all available questionnaires
3. **Updated SYSTEM_PROMPT:** Added critical rules:
   - "When the user message includes AVAILABLE QUESTIONNAIRES, you MUST select questionnaires from that list"
   - "Match the clinical intent to the CLOSEST available questionnaire by type and purpose"
   - "Include questionnaireId and questionnaireName fields in the action"
   - "Do NOT invent questionnaire names that aren't in the provided list"
4. **Inject Context:** Appends questionnaire list to the user message sent to Claude

**Example AI Prompt Addition:**
```
AVAILABLE QUESTIONNAIRES IN MEDPLUM:
- BloodTestOrderForm (ID: 450c56bf-48fd-43c7-a01a-89685423b59d, Type: lab): Form for ordering blood tests
- MedicationPrescriptionOrderForm (ID: abc-123-def, Type: medication): Medication prescription form

IMPORTANT: You MUST use questionnaire IDs from the list above. Do not invent questionnaire names.
```

**Updated Response Interface:**
```typescript
interface ClinicalActionResponse {
  type: 'medication' | 'lab' | 'imaging' | 'referral' | 'followup';
  description: string;
  questionnaireId?: string; // NEW
  questionnaireName?: string; // NEW
  resource: MedicationRequest | ServiceRequest | any;
}
```

### 3. `/contexts/SessionContext.tsx` (UPDATED)
**Purpose:** Manage session state and actions

**Key Changes:**
1. **Updated Interface:** Added questionnaire fields to `SuggestedAction`:
   ```typescript
   export interface SuggestedAction {
     // ...existing fields...
     questionnaireId?: string;
     questionnaireName?: string;
   }
   ```

2. **Updated Transform:** Modified `analyzeTranscript` to include questionnaire fields when mapping API response to frontend actions:
   ```typescript
   const transformedActions: SuggestedAction[] = data.actions.map((action: any, index: number) => ({
     // ...existing mappings...
     questionnaireId: action.questionnaireId,
     questionnaireName: action.questionnaireName,
   }));
   ```

### 4. `/components/QuestionnaireForm.tsx` (NEW)
**Purpose:** Dynamically render Medplum questionnaire questions

**Key Features:**
- Fetches specific questionnaire from `/api/questionnaire/[id]`
- Renders questions based on FHIR Questionnaire structure
- Supports multiple question types:
  - `string`: Single-line text input
  - `text`: Multi-line textarea
  - `boolean`: Yes/No radio buttons
  - `choice`: Select dropdown with options
  - `date`: Date picker
  - `integer`/`decimal`: Numeric inputs
  - `display`: Informational text
  - `group`: Nested question groups
- Tracks responses in state
- Calls `onResponseChange` callback when answers change
- Read-only or editable mode
- Loading and error states

**Usage:**
```tsx
<QuestionnaireForm 
  questionnaireId="450c56bf-48fd-43c7-a01a-89685423b59d"
  isEditable={true}
  initialResponses={{}}
  onResponseChange={(responses) => {
    console.log('User answers:', responses);
  }}
/>
```

### 5. `/components/ActionCard.tsx` (UPDATED)
### 5. `/components/ActionCard.tsx` (UPDATED)
**Purpose:** Display clinical action cards

**Key Changes:**
- Imports and uses `QuestionnaireForm` component
- Shows dynamic questionnaire when `action.questionnaireId` exists
- Falls back to hardcoded forms only if no questionnaire ID provided
- Both inline view and modal edit use QuestionnaireForm
- Questionnaire indicator shows which form is being used

**Logic:**
```tsx
{showForm && (
  action.questionnaireId ? (
    <QuestionnaireForm questionnaireId={action.questionnaireId} isEditable={false} />
  ) : (
    // Hardcoded fallback forms
  )
)}
```

## How It Works

### Step-by-Step Flow:

1. **User enters transcript** and clicks "Analyze"

2. **analyzeTranscript() is called** in SessionContext
   - Sends POST to `/api/analyze`

3. **Analyze endpoint fetches questionnaires:**
   ```typescript
   const questionnairesResponse = await fetch('/api/questionnaires');
   const availableQuestionnaires = data.questionnaires || [];
   ```

4. **Builds context for Claude:**
   ```
   AVAILABLE QUESTIONNAIRES IN MEDPLUM:
   - BloodTestOrderForm (ID: xyz-789, Type: lab): ...
   - MRIOrderForm (ID: abc-456, Type: imaging): ...
   ```

5. **Claude receives:**
   - System prompt with validation rules
   - Transcript to analyze
   - List of available questionnaires

6. **Claude generates actions** using ONLY questionnaires from the list:
   ```json
   {
     "type": "lab",
     "description": "Order CBC",
     "questionnaireId": "xyz-789",
     "questionnaireName": "BloodTestOrderForm",
     "resource": { ... }
   }
   ```

7. **Frontend receives actions** and displays:
   - Action card with questionnaire name
   - "Using form: BloodTestOrderForm" indicator
   - Form can be viewed/edited with actual Medplum form

## Benefits

✅ **No More Missing Forms:** AI only suggests forms that exist in Medplum
✅ **Transparency:** Users can see which form will be used
✅ **Closest Match:** If exact match doesn't exist, Claude selects closest available option
✅ **Type Safety:** TypeScript interfaces ensure questionnaire fields are handled correctly
✅ **Production Ready:** Prevents runtime errors when trying to create QuestionnaireResponses

## Testing

To test the implementation:

1. **Check available questionnaires:**
   ```bash
   curl http://localhost:3001/api/questionnaires
   ```

2. **Analyze a transcript:**
   - Enter patient consultation transcript
   - Click "Analyze with AI"
   - Verify suggested actions show questionnaire names
   - Check that questionnaireIds match actual Medplum forms

3. **Verify AI compliance:**
   - Look at console logs for questionnaire context
   - Confirm Claude only uses forms from provided list
   - Test with various clinical scenarios (labs, imaging, medications)

## Future Enhancements

- Add questionnaire preview in modal (show actual form fields from Medplum)
- Cache questionnaires to reduce API calls
- Filter questionnaires by patient context (age, conditions, etc.)
- Add fallback handling if no matching questionnaire exists
- Support for custom questionnaire matching logic based on SNOMED/LOINC codes
