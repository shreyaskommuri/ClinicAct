# Dynamic Questionnaire Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEDPLUM FHIR SERVER                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │  Questionnaire  │  │  Questionnaire  │  │  Questionnaire  ││
│  │  BloodTestOrder │  │  MRIOrderForm   │  │  MedicationRx   ││
│  │                 │  │                 │  │                 ││
│  │  - Questions    │  │  - Questions    │  │  - Questions    ││
│  │  - Item types   │  │  - Item types   │  │  - Item types   ││
│  │  - Validation   │  │  - Validation   │  │  - Validation   ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                             ▲  ▲
                             │  │
                    ┌────────┘  └────────┐
                    │                    │
            GET /api/questionnaires   GET /api/questionnaire/[id]
                    │                    │
┌───────────────────▼────────────────────▼───────────────────────┐
│                      NEXT.JS API LAYER                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  POST /api/analyze                                       │ │
│  │  1. Fetch all questionnaires from Medplum               │ │
│  │  2. Build context: "Available forms: BloodTest, MRI..." │ │
│  │  3. Send to Claude AI with transcript                   │ │
│  │  4. Claude returns action with questionnaireId          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Response: {                                             │ │
│  │    actions: [{                                           │ │
│  │      type: "lab",                                        │ │
│  │      description: "Order CBC",                           │ │
│  │      questionnaireId: "abc-123",                         │ │
│  │      questionnaireName: "BloodTestOrderForm"            │ │
│  │    }]                                                    │ │
│  │  }                                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND (SESSION)                     │
│                                                                 │
│  SessionContext.analyzeTranscript()                            │
│    └─> Transforms to SuggestedAction with:                    │
│        - questionnaireId                                       │
│        - questionnaireName                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ActionCard Component                                   │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ [Lab Icon] Order Complete Blood Count (CBC)       │  │  │
│  │  │ Using form: BloodTestOrderForm                    │  │  │
│  │  │ [Progress: 75%]                                   │  │  │
│  │  │                                                   │  │  │
│  │  │ [View Form] [Edit Form] [Approve]                │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  │                     │                                   │  │
│  │                     ▼                                   │  │
│  │  ┌───────────────────────────────────────────────────┐  │  │
│  │  │ QuestionnaireForm Component                       │  │  │
│  │  │                                                   │  │  │
│  │  │ 1. Fetches questionnaire by ID                   │  │  │
│  │  │ 2. Reads item[] structure from FHIR              │  │  │
│  │  │ 3. Renders each question:                        │  │  │
│  │  │    - Type of test: [Dropdown]                    │  │  │
│  │  │    - Priority: [Radio: Routine/STAT]             │  │  │
│  │  │    - Clinical notes: [Textarea]                  │  │  │
│  │  │ 4. Tracks responses: {                           │  │  │
│  │  │      "test-type": "CBC",                         │  │  │
│  │  │      "priority": "stat"                          │  │  │
│  │  │    }                                             │  │  │
│  │  └───────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Claude AI Prompt Flow

```
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT                                               │
│                                                             │
│ "You are a Clinical AI Assistant...                        │
│  CRITICAL RULES:                                           │
│  - When AVAILABLE QUESTIONNAIRES provided, MUST use them  │
│  - Do NOT invent questionnaire names                      │
│  - Match clinical intent to CLOSEST available form"       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ USER MESSAGE                                                │
│                                                             │
│ "Analyze this transcript:                                  │
│  Patient needs CBC, chest X-ray, and amoxicillin 500mg    │
│                                                             │
│  AVAILABLE QUESTIONNAIRES IN MEDPLUM:                      │
│  - BloodTestOrderForm (ID: abc-123, Type: lab)            │
│  - XRayOrderForm (ID: def-456, Type: imaging)             │
│  - MedicationPrescriptionOrderForm (ID: ghi-789, Type: medication)│
│                                                             │
│  IMPORTANT: Use questionnaire IDs from above list ONLY"   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ CLAUDE RESPONSE (JSON)                                      │
│                                                             │
│ {                                                           │
│   "actions": [                                             │
│     {                                                      │
│       "type": "lab",                                       │
│       "description": "Order Complete Blood Count",         │
│       "questionnaireId": "abc-123",       ← FROM LIST     │
│       "questionnaireName": "BloodTestOrderForm"           │
│     },                                                     │
│     {                                                      │
│       "type": "imaging",                                   │
│       "questionnaireId": "def-456",       ← FROM LIST     │
│       "questionnaireName": "XRayOrderForm"                │
│     },                                                     │
│     {                                                      │
│       "type": "medication",                                │
│       "questionnaireId": "ghi-789",       ← FROM LIST     │
│       "questionnaireName": "MedicationPrescriptionOrderForm"│
│     }                                                      │
│   ]                                                        │
│ }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Question Type Support

```
FHIR QuestionnaireItem.type → Frontend Rendering
────────────────────────────────────────────────
string                      → <input type="text" />
text                        → <textarea />
boolean                     → <input type="radio"> Yes/No
choice                      → <select> with answerOptions
date                        → <input type="date" />
integer                     → <input type="number" step="1" />
decimal                     → <input type="number" step="0.01" />
display                     → <p> informational text
group                       → Nested question group with border
```

## Example Questionnaire Structure

```json
{
  "resourceType": "Questionnaire",
  "id": "blood-test-order",
  "name": "BloodTestOrderForm",
  "title": "Blood Test Order Form",
  "item": [
    {
      "linkId": "test-type",
      "text": "Type of blood test",
      "type": "choice",
      "required": true,
      "answerOption": [
        {"valueCoding": {"code": "CBC", "display": "Complete Blood Count"}},
        {"valueCoding": {"code": "BMP", "display": "Basic Metabolic Panel"}},
        {"valueCoding": {"code": "LIPID", "display": "Lipid Panel"}}
      ]
    },
    {
      "linkId": "priority",
      "text": "Priority",
      "type": "choice",
      "required": true,
      "answerOption": [
        {"valueCoding": {"code": "routine", "display": "Routine"}},
        {"valueCoding": {"code": "stat", "display": "STAT"}}
      ]
    },
    {
      "linkId": "fasting",
      "text": "Fasting required?",
      "type": "boolean"
    },
    {
      "linkId": "clinical-notes",
      "text": "Clinical indication",
      "type": "text",
      "required": true
    }
  ]
}
```

## Response Tracking

```typescript
// QuestionnaireForm component state
const [responses, setResponses] = useState({
  "test-type": "CBC",           // User selected CBC from dropdown
  "priority": "stat",           // User selected STAT
  "fasting": true,              // User clicked Yes
  "clinical-notes": "Patient presents with fatigue and dizziness"
});

// When user changes an answer
handleResponseChange("test-type", "BMP");
// → Updates state
// → Calls onResponseChange callback
// → Parent can save to server
```
