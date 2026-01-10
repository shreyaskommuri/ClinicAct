# The Clinical Action Layer 🏥

AI-powered clinical documentation assistant that automates data entry by analyzing patient consultations and pre-filling orders for doctor approval.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Access to Medplum, Heidi Health API, and Anthropic API

### Installation

1. **Clone the repository and navigate to the project**
   ```bash
   cd clinical-action-layer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Get the `.env.local` file from the team (shared API keys for hackathon) and place it in the project root.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📦 Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend/Database**: Medplum (Headless FHIR R4 Server)
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **Input**: Heidi Health API (Consultation Transcripts)

## 🏗️ Project Structure

```
clinical-action-layer/
├── app/
│   ├── page.tsx              # Main UI component
│   ├── layout.tsx            # Root layout
│   └── api/
│       ├── heidi/            # Fetch Heidi transcripts
│       ├── analyze/          # Claude AI extraction (✅ Complete)
│       ├── medplum/          # Medplum patient queries (✅ Complete)
│       └── execute/          # Write FHIR resources to Medplum (✅ Complete)
├── components/
│   ├── ActionCard.tsx        # Individual action card UI
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── types.ts              # TypeScript definitions
│   └── medplum-client.ts     # Medplum SDK setup
└── .env.local                # Environment variables (git-ignored)
```

## 🔄 Workflow

1. **Ingest**: Fetch consultation transcript from Heidi API ✅
2. **Analyze**: Claude extracts clinical intents (medications, labs, imaging, referrals, follow-ups) ✅
3. **Review**: Doctor reviews pre-filled action cards in the UI (Frontend: In Progress)
4. **Execute**: Approved actions are written as FHIR resources to Medplum ✅

### Backend API Status
All core backend APIs are **100% complete** and production-ready:
- ✅ `POST /api/analyze` - Claude AI clinical action extraction
- ✅ `GET /api/heidi/transcript/{id}` - Fetch consultation transcripts
- ✅ `GET /api/medplum/patients` - Patient list retrieval
- ✅ `POST /api/execute` - Create FHIR resources (MedicationRequest, ServiceRequest)

See `EXECUTE_API.md` and `EXECUTE_IMPLEMENTATION_COMPLETE.md` for complete documentation.

## 🛠️ Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 📋 Key Dependencies

- `@medplum/core` - Medplum client SDK
- `@medplum/react` - Medplum React components
- `@anthropic-ai/sdk` - Anthropic Claude API
- `next` - Next.js framework
- `tailwindcss` - Utility-first CSS framework

## 🔐 Security Notes

- **Never commit `.env.local`** - it contains sensitive API keys
- The service role key has elevated permissions - handle with care
- All FHIR resources are created in "draft" status for review

## 🎯 SMART on FHIR Architecture

This app is designed as a SMART on FHIR application:
- Connects to Medplum via OAuth2 client credentials
- All data follows FHIR R4 specification
- Uses standard terminologies (LOINC, RxNorm, SNOMED CT)

## 🤝 Team Development

When pulling the latest code:
1. Run `npm install` to sync dependencies
2. Check if `.env.local` needs new variables (compare with `.env.example`)
3. Restart your dev server if environment variables changed

## 📝 License

Hackathon Project - Educational Use Only
