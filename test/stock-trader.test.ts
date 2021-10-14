import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as StockTrader from '../lib/stock-trader-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new StockTrader.StockTraderStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
