﻿// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'redis',
  connector: 'kv-memory',
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class AuthCacheDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'AuthCache';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.AuthCache', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
