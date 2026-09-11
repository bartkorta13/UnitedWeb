export const environment = {
  production: false,
  // Skierowane na lokalne API (./gradlew :core-service:run)
  apiUrl: 'http://localhost:8080',
  cdnUrl: 'https://d1rm5h55nlqrob.cloudfront.net',
  unitedTeamName: 'United_Środa_Śląska',
  cognito: {
    region: 'eu-central-1',
    userPoolId: '',
    clientId: '',
  },
};
