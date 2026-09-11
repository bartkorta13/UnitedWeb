export const environment = {
  production: false,
  // Skierowane na lokalne API (./gradlew :core-service:run)
  apiUrl: 'http://localhost:8080',
  cdnUrl: 'https://d1rm5h55nlqrob.cloudfront.net',
  unitedTeamName: 'United_Środa_Śląska',
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_Jv4bpcATR',
    clientId: '52ch3185gka9g4vr3p7bfijh0u',
  },
};
