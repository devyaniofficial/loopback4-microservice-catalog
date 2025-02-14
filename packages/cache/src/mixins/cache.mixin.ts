﻿// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {
  Entity,
  Filter,
  FilterExcludingWhere,
  JugglerDataSource,
  Options,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {SequelizeDataSource} from '@loopback/sequelize';
import * as crypto from 'crypto';
import {ICacheStrategy, RedisCacheStrategy} from '../strategies';
import {CacheStrategyTypes} from '../strategy-types.enum';
import {
  AbstractConstructor,
  CacheMixinBase,
  CachePluginComponentOptions,
  DEFAULT_CACHE_PLUGIN_OPTIONS,
  ICacheMixin,
  OptionsWithForceUpdate,
} from '../types';

const SKIP_CACHE_VALUES = ['1', 'true', 1, true];
export class CacheManager {
  static options: CachePluginComponentOptions = DEFAULT_CACHE_PLUGIN_OPTIONS;

  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  static CacheRepositoryMixin<
    M extends Entity,
    ID,
    Relations extends object,
    R extends CacheMixinBase<M, ID, Relations>,
  >(
    baseClass: R,
    cacheOptions: Partial<CachePluginComponentOptions>,
  ): R & AbstractConstructor<ICacheMixin<M, ID>> {
    abstract class MixedRepository extends baseClass {
      getCacheDataSource: () => Promise<
        JugglerDataSource | SequelizeDataSource
      >;
      strategy: ICacheStrategy<M>;
      private allCacheOptions: CachePluginComponentOptions;

      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      constructor(...args: any[]) {
        super(...args);
        this.allCacheOptions = {
          ...CacheManager.options,
          ...cacheOptions,
        };

        if (CacheManager.options.cacheProvider === CacheStrategyTypes.Redis) {
          this.strategy = new RedisCacheStrategy<M>(this.allCacheOptions);
        } else {
          throw new HttpErrors.NotImplemented(
            'Cache strategy is not implemented !',
          );
        }
      }

      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      async findById(
        id: ID,
        filter?: FilterExcludingWhere<M>,
        options?: OptionsWithForceUpdate,
      ): Promise<M> {
        if (SKIP_CACHE_VALUES.includes(process.env.SKIP_CACHE ?? false)) {
          return super.findById(id, filter, options);
        }
        this.checkDataSource();
        const key = await this.generateKey(id, filter);
        let finalResult: M;
        if (options?.forceUpdate) {
          finalResult = await super.findById(id, filter, options);
          this.strategy
            .saveInCache(key, finalResult)
            .catch(err => console.error(err)); //NOSONAR
        } else {
          const result = (await this.strategy.searchInCache(key)) as M;
          if (result) {
            finalResult = result;
          } else {
            finalResult = await super.findById(id, filter, options);
            this.strategy
              .saveInCache(key, finalResult)
              .catch(err => console.error(err)); //NOSONAR
          }
        }

        return finalResult;
      }

      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      async find(
        filter?: Filter<M> | undefined,
        options?: OptionsWithForceUpdate,
      ): Promise<M[]> {
        if (SKIP_CACHE_VALUES.includes(process.env.SKIP_CACHE ?? false)) {
          return super.find(filter, options);
        }
        this.checkDataSource();
        const key = await this.generateKey(undefined, filter);
        let finalResult: M[];
        if (options?.forceUpdate) {
          finalResult = await super.find(filter, options);
          this.strategy
            .saveInCache(key, finalResult)
            .catch(err => console.error(err)); //NOSONAR
        } else {
          const result = (await this.strategy.searchInCache(key)) as M[];
          if (result) {
            finalResult = result;
          } else {
            finalResult = await super.find(filter, options);
            this.strategy
              .saveInCache(key, finalResult)
              .catch(err => console.error(err)); //NOSONAR
          }
        }

        return finalResult;
      }

      /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      async findOne(
        filter?: Filter<M>,
        options?: Options,
      ): Promise<(M & Relations) | null> {
        if (SKIP_CACHE_VALUES.includes(process.env.SKIP_CACHE ?? false)) {
          return super.findOne(filter, options);
        }
        this.checkDataSource();
        const key = await this.generateKey(undefined, filter);
        let finalResult: (M & Relations) | null;
        if (options?.forceUpdate) {
          finalResult = await super.findOne(filter, options);
          this.strategy
            .saveInCache(key, finalResult)
            .catch(err => console.error(err)); //NOSONAR
        } else {
          const result = (await this.strategy.searchInCache(key)) as
            | (M & Relations)
            | null;
          // check is only for undefined as result of type null can also be stored in cache
          if (result !== undefined) {
            finalResult = result;
          } else {
            finalResult = await super.findOne(filter, options);
            this.strategy
              .saveInCache(key, finalResult)
              .catch(err => console.error(err)); //NOSONAR
          }
        }
        return finalResult;
      }

      async clearCache(): Promise<void> {
        this.checkDataSource();
        return this.strategy.clearCache();
      }

      async generateKey(id?: ID, filter?: Filter<M>): Promise<string> {
        let key = '';
        if (id) {
          key += `_${id}`;
        }
        if (filter) {
          key += `_${JSON.stringify(filter)}`;
        }
        // hash to reduce key length
        return (
          this.allCacheOptions.prefix +
          crypto.createHash('sha256').update(key).digest('hex')
        );
      }

      checkDataSource(): void {
        if (!this.getCacheDataSource) {
          throw new Error(`Please provide value for getCacheDataSource`);
        }
        this.strategy.getCacheDataSource = this.getCacheDataSource;
      }
    }
    return MixedRepository;
  }
}
