﻿// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {Getter, inject} from '@loopback/core';
import {
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  juggler,
  repository,
} from '@loopback/repository';
import {
  DefaultUserModifyCrudRepository,
  IAuthUserWithPermissions,
} from '@sourceloop/core';
import {AuthenticationBindings} from 'loopback4-authentication';

import {
  ConditionalAuditRepositoryMixin,
  IAuditMixinOptions,
} from '@sourceloop/audit-log';
import {UserTenantDataSourceName} from '../keys';
import {Role, RoleRelations, UserTenant, UserView} from '../models';
import {AuditLogRepository} from './audit.repository';
import {UserTenantRepository} from './user-tenant.repository';
import {UserViewRepository} from './user-view.repository';

const RoleAuditOpts: IAuditMixinOptions = {
  actionKey: 'Role_Logs',
};

export class RoleRepository extends ConditionalAuditRepositoryMixin(
  DefaultUserModifyCrudRepository<
    Role,
    typeof Role.prototype.id,
    RoleRelations
  >,
  RoleAuditOpts,
) {
  public readonly userTenants: HasManyRepositoryFactory<
    UserTenant,
    typeof Role.prototype.id
  >;

  public readonly createdByUser: HasOneRepositoryFactory<
    UserView,
    typeof Role.prototype.id
  >;

  public readonly modifiedByUser: HasOneRepositoryFactory<
    UserView,
    typeof Role.prototype.id
  >;

  constructor(
    @inject(`datasources.${UserTenantDataSourceName}`)
    dataSource: juggler.DataSource,
    @inject.getter(AuthenticationBindings.CURRENT_USER)
    protected readonly getCurrentUser: Getter<
      IAuthUserWithPermissions | undefined
    >,
    @repository.getter('UserTenantRepository')
    protected userTenantRepositoryGetter: Getter<UserTenantRepository>,
    @repository.getter('UserViewRepository')
    protected userViewRepositoryGetter: Getter<UserViewRepository>,
    @repository.getter('AuditLogRepository')
    public getAuditLogRepository: Getter<AuditLogRepository>,
  ) {
    super(Role, dataSource, getCurrentUser);
    this.modifiedByUser = this.createHasOneRepositoryFactoryFor(
      'modifiedByUser',
      userViewRepositoryGetter,
    );
    this.registerInclusionResolver(
      'modifiedByUser',
      this.modifiedByUser.inclusionResolver,
    );
    this.createdByUser = this.createHasOneRepositoryFactoryFor(
      'createdByUser',
      userViewRepositoryGetter,
    );
    this.registerInclusionResolver(
      'createdByUser',
      this.createdByUser.inclusionResolver,
    );
    this.userTenants = this.createHasManyRepositoryFactoryFor(
      'userTenants',
      userTenantRepositoryGetter,
    );
    this.registerInclusionResolver(
      'userTenants',
      this.userTenants.inclusionResolver,
    );
  }
}
