export const environment = {
  production: false,
  // Development local API (./gradlew :core-service:run)
  apiUrl: 'http://localhost:8080',
  // Development CloudFront CDN for media assets (photos & logos)
  cdnUrl: 'https://dxrcawhjt411l.cloudfront.net',
  unitedTeamName: 'United_Środa_Śląska',
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_Jv4bpcATR',
    clientId: '52ch3185gka9g4vr3p7bfijh0u',
  },
};
