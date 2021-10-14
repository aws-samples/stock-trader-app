#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { StockTraderStack } from '../lib/stock-trader-stack';

const app = new cdk.App();
new StockTraderStack(app, 'stock-trader-app');
