import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { Code, Function, Runtime, Tracing } from '@aws-cdk/aws-lambda';
import { Choice, Condition, JsonPath, StateMachine } from '@aws-cdk/aws-stepfunctions';
import { DynamoAttributeValue, DynamoPutItem, LambdaInvoke } from '@aws-cdk/aws-stepfunctions-tasks';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { SfnStateMachine } from '@aws-cdk/aws-events-targets';
import * as cdk from '@aws-cdk/core';
import { CfnOutput, Duration } from '@aws-cdk/core';

export class StockTraderStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ###################################################
    // Transactions DDB table
    // ###################################################
    const transactionTable = new Table(this, "TransactionTable", {
      partitionKey: {name: 'Id', type: AttributeType.STRING},
      readCapacity: 1,
      writeCapacity: 1
    })

    // ###################################################
    // Stock checker function
    // ###################################################
    const stockCheckerFunction = new Function(this, "StockCheckerFunction", {
      runtime: Runtime.PYTHON_3_8,
      handler: 'app.lambda_handler',
      code: Code.fromAsset('src/stock_checker'),
      tracing: Tracing.ACTIVE
    })

    // ###################################################
    // Stock seller function
    // ###################################################
    const stockSellerFunction = new Function(this, "StockSellerFunction", {
      runtime: Runtime.PYTHON_3_8,
      handler: 'app.lambda_handler',
      code: Code.fromAsset('src/stock_seller'),
      tracing: Tracing.ACTIVE
    })

    // ###################################################
    // Stock buyer function
    // ###################################################
    const stockBuyerFunction = new Function(this, "StockBuyerFunction", {
      runtime: Runtime.PYTHON_3_8,
      handler: 'app.lambda_handler',
      code: Code.fromAsset('src/stock_buyer'),
      tracing: Tracing.ACTIVE
    })

    // ###################################################
    // Stock Trading tasks and state machine
    // ###################################################
    const checkStockValue = new LambdaInvoke(this, "CheckStockValue", {
      lambdaFunction: stockCheckerFunction,
      payloadResponseOnly: true
    }).addRetry({
      errors: [
        "States.TaskFailed"
      ],
      interval: Duration.seconds(15),
      maxAttempts: 5,
      backoffRate: 1.5
    })

    const sellStock = new LambdaInvoke(this, "SellStock", {
      lambdaFunction: stockSellerFunction,
      payloadResponseOnly: true
    }).addRetry({
      errors: [
        "States.TaskFailed"
      ],
      interval: Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 1
    })

    const buyStock = new LambdaInvoke(this, "BuyStock", {
      lambdaFunction: stockBuyerFunction,
      payloadResponseOnly: true
    }).addRetry({
      errors: [
        "States.TaskFailed"
      ],
      interval: Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 1
    })

    const recordTransaction = new DynamoPutItem(this, "RecordTransaction", {
      item: {
        Id: DynamoAttributeValue.fromString(JsonPath.stringAt("$.id")),
        Type: DynamoAttributeValue.fromString(JsonPath.stringAt("$.type")),
        Price: DynamoAttributeValue.fromString(JsonPath.stringAt("$.price")),
        Quantity: DynamoAttributeValue.fromString(JsonPath.stringAt("$.qty")),
        Timestamp: DynamoAttributeValue.fromString(JsonPath.stringAt("$.timestamp"))
      },
      table: transactionTable
    }).addRetry({
      errors: [
        "States.TaskFailed"
      ],
      interval: Duration.seconds(20),
      maxAttempts: 5,
      backoffRate: 10
    })

    const buyOrSell = new Choice(this, "BuyOrSell", {})
      .when(Condition.numberLessThan("$.stock_price", 50), buyStock)
      .otherwise(sellStock)
      .afterwards().next(recordTransaction)

    const stateMachineDefinition = 
      checkStockValue
      .next(buyOrSell)

    const stockTradingStateMachine = new StateMachine(this, "StockTradingStateMachine", {
      definition: stateMachineDefinition,
      tracingEnabled: true
    })

    transactionTable.grantWriteData(stockTradingStateMachine)
    stockCheckerFunction.grantInvoke(stockTradingStateMachine)
    stockBuyerFunction.grantInvoke(stockTradingStateMachine)
    stockSellerFunction.grantInvoke(stockTradingStateMachine)

    // ###################################################
    // Stock Trading state machine schedule
    // ###################################################
    const stateMachineTarget = new SfnStateMachine(stockTradingStateMachine)

    new Rule(this, 'MinuteTradingSchedule', {
      schedule: Schedule.cron({}),
      targets: [stateMachineTarget],
     });

    // ###################################################
    // Outputs
    // ###################################################
    new CfnOutput(this, 'Check Stock Function Name', {
      value: stockCheckerFunction.functionName
    })
    new CfnOutput(this, 'Buy Stock Function Name', {
      value: stockBuyerFunction.functionName
    })
    new CfnOutput(this, 'Sell Stock Function Name', {
      value: stockSellerFunction.functionName
    })
    new CfnOutput(this, "Stock Trading State Machine Name", {
      value: stockTradingStateMachine.stateMachineName
    })
    new CfnOutput(this, "Transaction Table", {
      value: transactionTable.tableName
    })
  }
}
