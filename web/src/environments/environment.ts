export const environment = {
  production: true,
  // Production API Gateway HTTP API
  apiUrl: 'https://601tz51c7e.execute-api.eu-central-1.amazonaws.com',
  // Production CloudFront CDN for media assets (photos & logos)
  cdnUrl: 'https://d1rm5h55nlqrob.cloudfront.net',
  unitedTeamName: 'United_Środa_Śląska',
  cognito: {
    region: 'eu-central-1',
    userPoolId: 'eu-central-1_Jv4bpcATR',
    clientId: '52ch3185gka9g4vr3p7bfijh0u',
  },
};
