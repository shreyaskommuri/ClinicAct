import { getAccessToken } from '../auth/token.js';

export const getPatients = async () => {
    const accessToken = await getAccessToken();

    const response = await fetch('https://api.medplum.com/fhir/R4/Patient?_count=100', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const data = await response.json();
    const entry = data.entry;

    const patients = [];

    for (const item of entry) {
        const patient = item.resource;
        const patientId = patient.id;
        const patientFirstName = patient.name[0].given[0];
        const patientLastName = patient.name[0].family;
        patients.push({ patientId, patientFirstName, patientLastName });
    }

    return patients;
}
