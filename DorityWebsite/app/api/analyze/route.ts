import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MedicationRequest, ServiceRequest } from '@medplum/fhirtypes';
import { fillMissingFields } from '@/lib/smart-dummy-data';
import { getMedplumClient } from '@/lib/medplum-client';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AnalyzeRequest {
  transcript: string;
  patientContext?: string;
  patient?: any; // Patient data from session context
}

interface ClinicalActionResponse {
  type: 'medication' | 'lab' | 'imaging' | 'referral' | 'followup' | 'scheduling';
  description: string;
  questionnaireId?: string; // Optional: ID of the Medplum Questionnaire to use
  questionnaireName?: string; // Optional: Human-readable name of the questionnaire
  resource: MedicationRequest | ServiceRequest | any;
  reason?: string;
  when?: string;
  subject?: string;
  body?: string;
}

interface AnalyzeResponse {
  actions: ClinicalActionResponse[];
}

const SYSTEM_PROMPT = `You are an expert Clinical AI Assistant specializing in FHIR R4.

Your task is to analyze clinical consultation transcripts and extract actionable clinical intents that can be converted into FHIR R4 resources.

CRITICAL RULES:
1. Output strictly raw JSON. No markdown formatting, no code blocks, no explanations.
2. Extract clinical actions into an array called "actions"
3. For each action, generate a Draft FHIR Resource:
   - MedicationRequest for medications/prescriptions
   - ServiceRequest for labs, imaging, referrals
   - QuestionnaireResponse for mental health screenings (PHQ-4)
   - Appointment for follow-ups and scheduling
4. Include a human-readable "description" for UI display
5. Categorize each action with a "type": "medication", "lab", "imaging", "referral", "followup", "questionnaire_response", or "scheduling"
6. **QUESTIONNAIRE MATCHING RULES - STRICT**:
   - When the user message includes AVAILABLE QUESTIONNAIRES, you MUST ONLY select from that exact list
   - NEVER create an action type unless a matching questionnaire exists in the provided list
   - If a clinical action doesn't have a matching questionnaire, DO NOT include that action
   - Match action type to questionnaire type: medication→medication, lab→lab, imaging→imaging, referral→referral, followup→followup
   - Include "questionnaireId" and "questionnaireName" fields for EVERY action that has a matching questionnaire
   - If no questionnaire matches the clinical intent, skip that action entirely UNLESS it's a scheduling action

TYPE DEFINITIONS:
- "medication": Prescriptions and drug orders
- "lab": Laboratory tests
- "imaging": Radiology/Imaging studies
- "referral": Referrals to other specialists
- "followup": Clinical follow-up appointments within the EMR (e.g. "See patient in 2 weeks")
- "scheduling": Email communications to the patient regarding next steps, follow-ups, or summary of instructions.
   - For "scheduling" actions, YOU MUST INCLUDE:
     - "reason": Internal reason for the scheduling (brief).
     - "when": Suggested time (brief).
     - "subject": A user-friendly email subject line.
     - "body": A warm, user-friendly email body that:
       * Summarizes key information from the consultation
       * Includes follow-up instructions and timing if applicable
       * MUST include patient's insurance information if provided (e.g., "Insurance: Blue Cross Blue Shield")
       * MUST include practitioner information if provided (e.g., "Practitioner: Dr. Smith" and address)
       * MUST include preferred pharmacy if provided (e.g., "Practitioner Address: 123 Main St")
       * Uses a professional yet warm tone
       * Only includes information that has actual values (skip fields marked as "Not specified")

OUTPUT FORMAT (raw JSON only):
{
  "actions": [
    {
      "type": "medication",
      "description": "Prescribe Amoxicillin 500mg three times daily for 7 days",
      "questionnaireId": "abc-123-def",
      "questionnaireName": "MedicationPrescriptionOrderForm",
      "resource": {
        "resourceType": "MedicationRequest",
        "status": "draft",
        "intent": "order",
        "medicationCodeableConcept": {
          "coding": [{
            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
            "code": "308182",
            "display": "Amoxicillin 500 MG"
          }],
          "text": "Amoxicillin 500mg"
        },
        "dosageInstruction": [{
          "text": "500mg three times daily for 7 days",
          "timing": {
            "repeat": {
              "frequency": 3,
              "period": 1,
              "periodUnit": "d"
            }
          },
          "doseAndRate": [{
            "doseQuantity": {
              "value": 500,
              "unit": "mg"
            }
          }]
        }]
      }
    },
    {
      "type": "lab",
      "description": "Order Complete Blood Count (CBC)",
      "questionnaireId": "xyz-789-ghi",
      "questionnaireName": "BloodTestOrderForm",
      "resource": {
        "resourceType": "ServiceRequest",
        "status": "draft",
        "intent": "order",
        "category": [{
          "coding": [{
            "system": "http://snomed.info/sct",
            "code": "108252007",
            "display": "Laboratory procedure"
          }]
        }],
        "code": {
          "coding": [{
            "system": "http://loinc.org",
            "code": "58410-2",
            "display": "Complete blood count (hemogram) panel"
          }],
          "text": "CBC"
        },
        "priority": "routine"
      }
    },
    {
      "type": "scheduling",
      "description": "Send follow-up email regarding care plan",
      "reason": "Patient needs follow-up instructions and care plan details",
      "when": "Within 24 hours",
      "subject": "Your Care Plan and Next Steps",
      "body": "Dear [Patient Name],\n\nThank you for coming in today. Based on our consultation, here's a summary of your care plan:\n\n[Summary of key points from consultation]\n\nNext Steps:\n1. [Follow-up instruction 1]\n2. [Follow-up instruction 2]\n\nYour Information:\nInsurance: [Patient Insurance from Medplum]\nPreferred Pharmacy: [Patient Pharmacy from Medplum]\nPractitioner: [Practitioner Name]\nPractitioner Address: [Practitioner Address]\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nYour Care Team",
      "resource": {
        "resourceType": "Appointment",
        "status": "proposed",
        "description": "Follow-up communication regarding care plan"
      }
    }
  ]
}

IMPORTANT FHIR GUIDELINES:
- MedicationRequest MUST have: resourceType, status ("draft"), intent ("order"), medicationCodeableConcept
- ServiceRequest MUST have: resourceType, status ("draft"), intent ("order"), code
- **CRITICAL FOR IMAGING/LABS**: ServiceRequest MUST include:
  * code: { text: "name of test/scan" }
  * bodySite: [{ text: "anatomical location" }] (e.g., "chest", "abdomen", "pelvis")
  * priority: "routine" | "urgent" | "asap" | "stat"
  * reasonCode: [{ text: "clinical indication/reason for ordering" }]
  * category: [{ text: "type of service" }] (e.g., "Laboratory", "Radiology")
- Use standard coding systems: RxNorm for medications, LOINC for labs, SNOMED CT for procedures
- Set status to "draft" (not "active") since these need doctor approval
- Include display text for all codes for human readability
- Include as much detail as possible from the transcript in the FHIR resource fields
- If you cannot determine specific codes, use text-only descriptions

**CRITICAL DATA FILLING RULES:**
1. For patient demographic fields (name, DOB, phone, email, MRN, address, etc.):
   - ALWAYS use the EXACT values provided in the PATIENT INFORMATION section
   - NEVER use placeholders like "Unknown", "N/A", "[Patient Name]"
   
2. For clinical fields (exam type, medication, indication, body region, etc.):
   - Extract specific values from the transcript
   - Be as detailed and specific as possible
   - Example: Instead of "chest pain", use "Evaluate for acute coronary syndrome - patient presents with substernal chest pressure radiating to left arm"
   
3. For fields not in transcript or patient data:
   - Provider names: Use realistic names like "Dr. Sarah Chen, MD", "Dr. Michael Johnson, MD"
   - NPI numbers: Use format "1234567890"
   - DEA numbers: Use format "AB1234567"
   - Dates: Use current date for orders (format: YYYY-MM-DD)
   - Times: Use realistic medical times like "09:00", "14:00", "16:00"
   - Priorities: Use "routine", "urgent", or "stat" based on clinical urgency
   - Phone numbers: Use patient's actual phone or format "555-0123"
   - Signatures: Use "Electronically signed"
   
4. NEVER leave fields blank or use placeholder text - every field must have a realistic, actionable value

**EXAMPLE IMAGING ORDER WITH QUESTIONNAIRE:**
{
  "type": "imaging",
  "description": "Order CT scan of chest to evaluate pneumonia",
  "questionnaireId": "xyz-123",
  "questionnaireName": "CT Scan Request Form",
  "resource": {
    "resourceType": "QuestionnaireResponse",
    "status": "in-progress",
    "questionnaire": "Questionnaire/xyz-123",
    "item": [
      {
        "linkId": "patientName",
        "answer": [{"valueString": "John Smith"}]
      },
      {
        "linkId": "examType",
        "answer": [{"valueString": "CT Scan"}]
      },
      {
        "linkId": "bodyRegion",
        "answer": [{"valueString": "chest"}]
      },
      {
        "linkId": "clinicalIndication",
        "answer": [{"valueString": "Evaluate pneumonia, patient has persistent cough and fever"}]
      },
      {
        "linkId": "priority",
        "answer": [{"valueCoding": {"code": "routine", "display": "Routine"}}]
      }
    ]
  }
}

**IMPORTANT:** The "item" array should contain entries for EACH linkId from the questionnaire definition, with answers extracted from the transcript.

MENTAL HEALTH SCREENING LOGIC (PHQ-4):
IF the patient mentions symptoms of Anxiety (nervous, edge, worry) OR Depression (down, lost interest):
- Create a "QuestionnaireResponse" resource.
- Set "questionnaire" to "Questionnaire/bb1ece1d-7116-49d9-a082-86262208b517" (The ID of the PHQ-4 form).
- Extract answers based on the transcript using these EXACT linkIds:
  - Anxiety Q1 (Nervous/Edge) -> linkId: "/69725-0"
  - Anxiety Q2 (Worrying)     -> linkId: "/68509-9"
  - Depression Q3 (Interest)  -> linkId: "/44250-9"
  - Depression Q4 (Hopeless)  -> linkId: "/44255-8"
- For the answer values, you MUST use valueCoding from this list:
  - "Not at all" (Code: LA6568-5)
  - "Several days" (Code: LA6569-3)
  - "More than half the days" (Code: LA6570-1)
  - "Nearly every day" (Code: LA6571-9)

EXAMPLE QUESTIONNAIRE OUTPUT:
{
  "type": "questionnaire_response",
  "description": "Auto-filled PHQ-4 Mental Health Screen",
  "resource": {
    "resourceType": "QuestionnaireResponse",
    "status": "completed",
    "questionnaire": "Questionnaire/bb1ece1d-7116-49d9-a082-86262208b517",
    "item": [
      {
        "linkId": "/69725-0",
        "answer": [{ "valueCoding": { "code": "LA6569-3", "display": "Several days" } }]
      }
      // ... other items
    ]
  }
}

Extract ONLY clinically actionable items:
- Medications/prescriptions
- Lab tests
- Imaging studies
- Specialist referrals
- Follow-up appointments
- Scheduling/Administrative meetings

Do NOT extract:
- General advice or counseling
- Lifestyle recommendations without specific follow-up
- Past medical history
- Physical exam findings (unless they require action)`;

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { transcript, patientContext, patient } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid transcript in request body' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Fetch available questionnaires from Medplum first
    let availableQuestionnaires: any[] = [];
    try {
      const questionnairesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/questionnaires`);
      if (questionnairesResponse.ok) {
        const data = await questionnairesResponse.json();
        availableQuestionnaires = data.questionnaires || [];
        console.log(`[Analyze] Found ${availableQuestionnaires.length} available questionnaires in Medplum`);
        
        // Fetch full questionnaire definitions for the relevant ones
        const questionnaireDetails = await Promise.all(
          availableQuestionnaires.map(async (q) => {
            try {
              const detailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/questionnaire/${q.id}`);
              if (detailResponse.ok) {
                const detail = await detailResponse.json();
                return {
                  id: q.id,
                  name: q.name,
                  type: q.type,
                  title: q.title,
                  description: q.description,
                  items: detail.questionnaire?.item || []
                };
              }
            } catch (err) {
              console.warn(`[Analyze] Failed to fetch questionnaire ${q.id}:`, err);
            }
            return null;
          })
        );
        
        availableQuestionnaires = questionnaireDetails.filter(q => q !== null);
        console.log(`[Analyze] Loaded ${availableQuestionnaires.length} full questionnaire definitions`);
      }
    } catch (err) {
      console.warn('[Analyze] Could not fetch questionnaires, proceeding with generic forms', err);
    }

    // Build questionnaire context for the AI
    const questionnaireContext = availableQuestionnaires.length > 0
      ? `\n\nAVAILABLE QUESTIONNAIRES IN MEDPLUM:\n${availableQuestionnaires.map(q => {
          const itemsSummary = q.items.map((item: any) => {
            let optionsText = '';
            if (item.answerOption && item.answerOption.length > 0) {
              // Include BOTH code and display for choice fields so Claude knows exact codes to use
              const optionsList = item.answerOption.map((opt: any) => {
                if (opt.valueCoding) {
                  return `{code: "${opt.valueCoding.code}", display: "${opt.valueCoding.display}"}`;
                } else if (opt.valueString) {
                  return `"${opt.valueString}"`;
                }
                return '';
              }).filter(Boolean).join(', ');
              optionsText = `, options: [${optionsList}]`;
            }
            
            return `  - linkId: "${item.linkId}", text: "${item.text}", type: ${item.type}${item.required ? ' (REQUIRED)' : ''}${optionsText}`;
          }).join('\n');
          
          return `\n**Questionnaire: ${q.name}** (ID: ${q.id}, Type: ${q.type})\nTitle: ${q.title || 'N/A'}\nDescription: ${q.description || 'N/A'}\nFields:\n${itemsSummary}\n`;
        }).join('\n')}\n\n**CRITICAL INSTRUCTIONS FOR USING QUESTIONNAIRES:**
- You MUST generate a QuestionnaireResponse resource that fills out ALL the fields (linkIds) listed above
- For each action, include "questionnaireId" and "questionnaireName" 
- The "resource" MUST be a QuestionnaireResponse with "item" array containing answers for EVERY single linkId from the questionnaire definition
- For NESTED GROUPS (type: group), you must create items with nested "item" arrays, not "answer" arrays
- For QUESTION FIELDS (non-group types), create answer arrays with the appropriate value type
- Extract values from the transcript and match them to the appropriate linkIds
- For patient demographic fields, use the EXACT patient data provided in the prompt
- For fields not mentioned in the transcript, use intelligent defaults based on the field name and clinical context
- **CRITICAL FOR CHOICE FIELDS:** For fields with type "choice" and answerOption listed above:
  * You MUST select ONE of the provided options
  * ALWAYS use valueCoding format: {"valueCoding": {"code": "option_code", "display": "Option Display"}}
  * Use the EXACT code and EXACT display from the answerOption list above - DO NOT modify or paraphrase
  * Copy the code and display EXACTLY as shown - character for character
  * NEVER invent your own codes or display text - only use what's in the options list
  * If the transcript doesn't specify which option, choose the most clinically appropriate option from the list
  * Example: If options show {code: "78816", display: "Whole Body (head to toe protocol)"}, you MUST use exactly that code and display
- For boolean fields, use valueBoolean (not valueString)
- If a clinical action doesn't match any questionnaire type, skip that action entirely

**NESTED GROUP STRUCTURE EXAMPLE:**
If a questionnaire has groups with nested items, the item array should contain BOTH group containers AND their nested fields.
For a group linkId "exam-details" containing "examType" and "bodyRegion", format like:
{
  "linkId": "exam-details",
  "item": [
    { "linkId": "examType", "answer": [{"valueString": "CT Scan"}] },
    { "linkId": "bodyRegion", "answer": [{"valueString": "Chest"}] }
  ]
}

**CHOICE FIELD EXAMPLE:**
For a choice field like "Is a referral needed?" with options ["Yes", "No"]:
{
  "linkId": "referral-needed",
  "answer": [{"valueCoding": {"code": "yes", "display": "Yes"}}]
}

**YOU MUST INCLUDE AN ITEM (or nested items for groups) FOR EVERY SINGLE LINKID IN THE QUESTIONNAIRE!**
**YOU MUST SELECT A VALUE FOR EVERY CHOICE FIELD FROM ITS ANSWEROPTIO NS - NEVER LEAVE THEM EMPTY!**`
      : '';

    // Build user message
    let userMessage = `Analyze this clinical consultation transcript and extract actionable clinical intents:\n\n${transcript}`;
    
    // Add patient data for better autofill
    if (patient) {
      userMessage += `\n\n**PATIENT INFORMATION FROM MEDPLUM (Use EXACT values below for patient demographic fields):**
- Patient Name: ${patient.name || 'Unknown'}
- Date of Birth: ${patient.dob || 'Unknown'}
- Age: ${patient.age || 'Unknown'}
- Gender: ${patient.gender || 'Unknown'}
- MRN: ${patient.mrn || 'Unknown'}
- Phone: ${patient.phone || 'Unknown'}
- Mobile Phone: ${patient.phone || 'Unknown'}
- Home Phone: ${patient.phone || 'Unknown'}
- Work Phone: ${patient.phone || 'Unknown'}
- Email: ${patient.email || 'Unknown'}
- Address: ${patient.address || 'Unknown'}
- Emergency Contact: ${patient.emergencyContactName || 'Unknown'}
- Emergency Phone: ${patient.emergencyContactPhone || 'Unknown'}
- Preferred Pharmacy: ${patient.preferredPharmacy || 'Unknown'}
- Insurance: ${patient.insurance || 'Unknown'}
- Primary Care Provider: ${patient.generalPractitioner || 'Unknown'}
- Organization Address: ${patient.organizationAddress || 'Unknown'}

**CRITICAL INSTRUCTIONS FOR USING PATIENT DATA:**
1. For ANY patient demographic field (name, DOB, phone, email, address, MRN, etc.), USE THE EXACT VALUES ABOVE
2. For clinical fields not in the patient data (exam type, indication, medications, etc.), extract from the transcript
3. For fields not mentioned in transcript OR patient data, generate REALISTIC clinical values:
   - Phone numbers: Use format "555-0123" or the patient's actual phone
   - Dates: Use realistic medical dates (e.g., current date for order date, future dates for appointments)
   - Times: Use realistic times (e.g., "2:00 PM", "14:00")
   - Providers: Use realistic provider names (e.g., "Dr. Smith", "Dr. Johnson") unless specified in transcript
   - Clinical indicators: Be specific and realistic (e.g., "Evaluate for pneumonia - persistent cough and fever x3 days")
   - Priorities: Use "Routine", "Urgent", or "STAT" based on clinical context
   - Boolean fields: Use true/false appropriately (e.g., pregnancy: false for males, contrast: false unless specified)
4. When generating scheduling email bodies, INCLUDE the insurance, pharmacy, and practitioner information if provided above
5. Do NOT use "Unknown" or "Not specified" in email bodies - only include fields that have actual values
6. NEVER leave fields empty or use placeholders like "N/A", "[value]" - always provide realistic values`;
    } else if (patientContext) {
      userMessage += `\n\nPatient Context:\n${patientContext}`;
    }

    userMessage += questionnaireContext;

    console.log('[Analyze] ====== SENDING TO GEMINI ======');
    console.log('[Analyze] User message length:', userMessage.length);
    console.log('[Analyze] Questionnaire context preview:', questionnaireContext.substring(0, 500));

    // Call Gemini
    console.log('[Analyze] Calling Gemini API...');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userMessage);
    const response = result.response;
    const responseText = response.text();
    console.log('[Analyze] ====== CLAUDE RESPONSE ======');
    console.log('[Analyze] Full response:', responseText);
    console.log('[Analyze] ====== END RESPONSE ======');

    // Parse JSON from response (handle cases where Claude adds markdown or extra text)
    let parsedResponse: AnalyzeResponse;
    try {
      // Try direct parse firstGEMINI
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      // If direct parse fails, try to extract JSON from markdown code blocks or surrounding text
      console.log('[Analyze] Direct JSON parse failed, attempting extraction...');
      
      // Remove markdown code blocks
      let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON object boundaries
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      try {
        parsedResponse = JSON.parse(cleanedText);
      } catch (secondError) {
        console.error('[Analyze] Failed to parse Gemini response:', responseText);
        throw new Error('Failed to parse JSON from Gemini response');
      }
    }

    // Validate response structure
    if (!parsedResponse.actions || !Array.isArray(parsedResponse.actions)) {
      console.error('[Analyze] Invalid response structure:', parsedResponse);
      throw new Error('Invalid response structure: missing actions array');
    }

    // Validate each action and fill missing fields with smart dummy data
    const validatedActions = [];

    for (const action of parsedResponse.actions) {
      // Basic validation
      if (!action.type || !action.description) {
        console.warn('[Analyze] Skipping invalid action:', action);
        continue;
      }

      // Validate resource is present (except for scheduling which only needs email fields)
      if (action.type !== 'scheduling' && !action.resource) {
        console.warn('[Analyze] Skipping action missing resource:', action);
        continue;
      }

      // For scheduling, ensure we have the required email fields
      if (action.type === 'scheduling') {
        if (!action.subject && !action.body) {
          console.warn('[Analyze] Skipping scheduling action missing email fields:', action);
          continue;
        }
        // Add a default Appointment resource if not provided
        if (!action.resource) {
          action.resource = {
            resourceType: 'Appointment',
            status: 'proposed',
            description: action.description
          };
        }
      }

      if (!['medication', 'lab', 'imaging', 'referral', 'followup', 'questionnaire_response', 'scheduling'].includes(action.type)) {
        console.warn('[Analyze] Skipping action with invalid type:', action.type);
        continue;
      }
      
      // If this action has a QuestionnaireResponse, fill missing fields with smart dummy data
      if (action.resource.resourceType === 'QuestionnaireResponse' && action.questionnaireId) {
        try {
          console.log(`[Analyze] Filling missing fields for questionnaire: ${action.questionnaireName}`);
          
          // Fetch the full questionnaire to know all required fields
          const medplum = await getMedplumClient();
          const questionnaire = await medplum.readResource('Questionnaire', action.questionnaireId);
          
          // Extract clinical context from description
          const clinicalContext = action.description;
          const urgency = action.description.toLowerCase().includes('stat') || 
                         action.description.toLowerCase().includes('immediate') ? 'stat' :
                         action.description.toLowerCase().includes('urgent') ? 'urgent' : 'routine';
          
          // Fill missing fields with smart dummy data using REAL patient data from Medplum
          const filledResource = fillMissingFields(
            action.resource,
            questionnaire,
            {
              // Real patient data from Medplum
              patientName: patient?.name,
              patientAge: patient?.age,
              patientDob: patient?.dob,
              patientGender: patient?.gender,
              patientMrn: patient?.mrn,
              patientPhone: patient?.phone,
              patientEmail: patient?.email,
              patientAddress: patient?.address,
              emergencyContactName: patient?.emergencyContactName,
              emergencyContactPhone: patient?.emergencyContactPhone,
              preferredPharmacy: patient?.preferredPharmacy,
              insurance: patient?.insurance,
              // Clinical context
              clinicalContext,
              urgency
            }
          );
          
          console.log(`[Analyze] Fields filled for ${action.questionnaireName}:`, {
            originalItemCount: action.resource.item?.length || 0,
            filledItemCount: filledResource.item?.length || 0
          });
          
          action.resource = filledResource;
        } catch (fillError) {
          console.error(`[Analyze] Error filling fields for ${action.questionnaireName}:`, fillError);
          // Continue with original resource if filling fails
        }
      }
      
      validatedActions.push(action);
    }

    // Log action types for debugging
    const actionSummary = validatedActions.reduce((acc: any, action: any) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {});
    console.log(`[Analyze] Successfully processed ${validatedActions.length} actions:`, actionSummary);

    // Log scheduling actions specifically
    const schedulingActions = validatedActions.filter((a: any) => a.type === 'scheduling');
    if (schedulingActions.length > 0) {
      console.log(`[Analyze] Scheduling actions:`, schedulingActions.map((a: any) => ({
        description: a.description,
        hasSubject: !!a.subject,
        hasBody: !!a.body,
        hasResource: !!a.resource
      })));
    }

    return NextResponse.json({
      actions: validatedActions,
    });

  } catch (error) {
    console.error('[Analyze] Error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze transcript',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
