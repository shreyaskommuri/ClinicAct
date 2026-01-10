import express from 'express';
import { getPatients } from './services/patients.js';


const app = express();
const port = process.env.PORT || 3000;

app.get('/patients', async (req, res) => {
  const patients = await getPatients();
  res.json(patients);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

