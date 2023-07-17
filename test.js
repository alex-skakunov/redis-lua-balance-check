const aws = require('aws-sdk');
const fs = require('fs');

aws.config.update({
  region: 'us-east-1',
  accessKeyId: 'AAA',
  secretAccessKey: 'BBB',
});
const lambda = new aws.Lambda();

const functionName = 'redis-stack-charge_request_redis-lambda-fn';

async function invokeLambda(charge=2) {
    const json = {unit: charge};
    const payloadString = JSON.stringify(json);
    return await lambda.invoke({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: payloadString
     }).promise();
}

invokeLambda().then((result) => {
  console.log(result);
  const json = result.Payload;
  const stat = JSON.parse(json);
  const time = stat.checkBalanceTime;
  if (time < 25) {
    console.log('Timing requirement is met');
  }
  else {
    console.log('Timing requirement is NOT met');
  }
});