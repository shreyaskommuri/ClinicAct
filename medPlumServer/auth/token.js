
import config from "../config.js";

export const getAccessAndIdToken = async () => {
    const accessTokenUrl = "https://api.medplum.com/oauth2/token";
    const clientId = config.medPlumClientId;
    const clientSecret = config.medPlumClientSecret;
    const grantType = "client_credentials";
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    const body = {
        grant_type: grantType,
        client_id: clientId,
        client_secret: clientSecret
    }
    const response = await fetch(accessTokenUrl, {
        method: "POST",
        headers: headers,
        body: new URLSearchParams(body)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!data.access_token) {
        throw new Error("No access token found");
    }
    return data;
}

export const getAccessToken = async () => {
    const data = await getAccessAndIdToken();
    return data.access_token;
}

export const getIdToken = async () => {
    const data = await getAccessAndIdToken();
    return data.id_token;
}
