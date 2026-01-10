# Clinical Action Layer

AI-powered sidecar web application for Medplum EMR that generates and manages draft clinical orders from patient consultations.

## Overview

This Next.js application sits alongside an EMR system and uses AI to listen to patient consultations, automatically generating draft orders for doctors to review and approve. It features a complete 4-step workflow:

1. **Select Patient** - Search and select a patient from the EMR
2. **Transcript** - Enter or paste consultation transcript
3. **Actions** - Review and approve AI-generated draft orders
4. **After-care** - Generate and send patient-friendly summary email

It integrates with:

- **Medplum** - Headless FHIR server (backend)
- **Claude 3.5 Sonnet** - AI for clinical intent extraction
- **Heidi API** - Consultation transcripts

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Standards:** FHIR R4

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npx next dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
DorityWebsite/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main page with workflow
│   └── globals.css         # Global styles
├── components/
│   ├── WorkflowContext.tsx      # Shared state management
│   ├── WorkflowStepper.tsx      # 4-step progress indicator
│   ├── Sidebar.tsx              # Left navigation panel
│   ├── TopNav.tsx               # Top navigation bar
│   ├── PatientSearchPanel.tsx   # Patient search & selection
│   ├── TranscriptInputPanel.tsx # Transcript input & generation
│   ├── ActionList.tsx           # List of draft actions
│   ├── ActionCard.tsx           # Individual action card
│   ├── ActionDetailsModal.tsx   # Edit action details
│   └── AftercarePanel.tsx       # After-care email composer
└── package.json
```

## Features

### ✅ Complete 4-Step Workflow

**Step 1: Select Patient**
- Real-time debounced patient search (300ms)
- Mock data with name, MRN, DOB, key medical info
- Selectable patient cards with visual feedback
- Selected patient summary card
- Ready for Medplum Patient search integration

**Step 2: Transcript**
- Large textarea for consultation transcript
- Disabled until patient selected
- Character count
- "Generate Actions" button with loading state
- Smart mock data generation based on keywords
- Ready for Heidi API + Claude integration

**Step 3: Draft Actions**
- Loading, empty, and populated states
- Medication and service request cards
- Confidence scoring with visual indicators
- Individual card actions: View Details, Approve & Sign
- Approved cards show green badge and are disabled
- Auto-advances to Step 4 when all approved

**Step 4: After-care**
- Auto-generated patient-friendly summary
- Editable email address and message
- Preview email functionality
- Send email with success confirmation
- Ready for email service integration

### 🎨 UI/UX Features

- Horizontal workflow stepper with icons
- Two-column patient + transcript layout
- Clinical sidecar theme (slate/blue palette)
- Responsive design (mobile-first)
- Subtle shadows, borders, rounded corners
- Smooth state transitions
- Loading and success states throughout

### 🔧 Action Management

- **View Details Modal** - Edit any field before approval
  - Medication: dose, instructions, intent
  - Service: code, reason
  - Save changes or approve directly
- **Approval Workflow** - Track approved vs pending
- **State Management** - React Context for shared state

### 📧 After-Care Email

- Auto-generates summary from approved actions
- Separates medications and tests/procedures
- Includes next steps and instructions
- Editable before sending
- Email preview panel
- Simulated send with success toast

## Workflow State Machine

```
Step 1 (Select Patient)
  → User searches and selects patient
  → Auto-advances to Step 2

Step 2 (Transcript)  
  → User pastes transcript
  → Clicks "Generate Actions"
  → AI processes transcript (simulated)
  → Auto-advances to Step 3

Step 3 (Actions)
  → User reviews draft orders
  → Can edit details via modal
  → Approves each action
  → When all approved → Auto-advances to Step 4

Step 4 (After-care)
  → Auto-generates email summary
  → User reviews/edits
  → Sends email (simulated)
  → Workflow complete
```

## Data Flow

1. **Ingest:** Patient selected + Transcript entered (✅ Implemented with mock data)
2. **Process:** Transcript → Claude → FHIR resources (🚧 TODO: Real AI integration)
3. **Review:** Display Action Cards with approval workflow (✅ Implemented)
4. **Execute:** Approved actions → Medplum (🚧 TODO: Real FHIR creation)
5. **Follow-up:** Generate + send after-care email (🚧 TODO: Real email service)

## Development Guidelines

### Code Standards

- Use TypeScript for all files
- Functional React components with hooks
- Client components require `"use client"` directive
- Use concrete FHIR types from `@medplum/fhirtypes`
- Handle loading states and errors gracefully
- No `any` types - strict type safety

### Styling

- Tailwind utility classes only
- Clinical sidecar theme (slate/blue palette)
- Responsive design (mobile-first)
- Subtle shadows and borders (shadow-sm, border-slate-200)
- Rounded corners (rounded-lg)

### State Management

- **WorkflowContext** provides:
  - `currentStep`: Current workflow step (1-4)
  - `selectedPatient`: Selected patient object
  - `transcript`: Transcript text
  - `actions`: Array of draft actions
  - `allApproved`: Boolean - all actions approved
  - `isGenerating`: Loading state for AI generation
  - `updateAction`: Update specific action

## Integration Points (TODO)

### 🔌 Medplum FHIR Backend
- **Location:** `PatientSearchPanel.tsx` line 54
- **Action:** Replace mock patient search with `medplum.searchResources('Patient', { name: query })`
- **Location:** `ActionCard.tsx` & `ActionDetailsModal.tsx`
- **Action:** On approve, call `medplum.createResource('MedicationRequest' | 'ServiceRequest', fhirResource)`

### 🤖 Claude AI Processing
- **Location:** `TranscriptInputPanel.tsx` line 36
- **Action:** Create `/api/actions` route that:
  1. Receives `{ patientId, transcript }`
  2. Calls Claude with clinical extraction prompt
  3. Maps Claude output to FHIR resources
  4. Returns array of `ClinicalAction[]`

### 📝 Heidi API Integration
- **Location:** `TranscriptInputPanel.tsx` (optional enhancement)
- **Action:** Auto-fetch transcript from Heidi instead of manual paste

### 📧 Email Service
- **Location:** `AftercarePanel.tsx` line 82
- **Action:** Create `/api/aftercare-email` route with SendGrid, AWS SES, or similar
- **Payload:** `{ patientId, email, summary, actions }`

## Mock Data

Currently using hardcoded mock data for:
- 4 sample patients with realistic medical info
- AI-generated actions based on transcript keywords (metformin, cbc, lisinopril, a1c)
- Simulated network delays (300ms search, 1.5-2s generation)

## Testing the Workflow

1. **Start the app:** `npx next dev`
2. **Search for patient:** Type "John" → Select John Smith
3. **Enter transcript:** Paste sample text mentioning "metformin", "blood pressure", "CBC"
4. **Generate actions:** Click button → See 2-3 draft orders appear
5. **Review actions:** Click "View Details" to edit, then "Approve & Sign"
6. **Complete workflow:** After all approved, see After-care panel
7. **Send email:** Edit summary, preview, and send

## TODO

- [ ] Integrate Medplum SDK for real patient search
- [ ] Set up backend API route for Claude processing
- [ ] Wire up FHIR resource creation in Medplum
- [ ] Integrate Heidi API for transcript fetching
- [ ] Add real email service integration
- [ ] Add authentication/authorization
- [ ] Implement real-time updates
- [ ] Add unit and integration tests
- [ ] Add error boundary components
- [ ] Add audit logging for approvals

## License

Private - Internal Use Only
