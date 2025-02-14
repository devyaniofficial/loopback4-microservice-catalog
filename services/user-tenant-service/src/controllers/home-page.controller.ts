﻿// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {inject} from '@loopback/context';
import {get, oas, OperationVisibility} from '@loopback/openapi-v3';
import {Response, RestBindings} from '@loopback/rest';
import {STATUS_CODE} from '@sourceloop/core';
import * as fs from 'fs';
import {authorize} from 'loopback4-authorization';
import * as path from 'path';

export class HomePageController {
  private readonly html: string;
  constructor(
    @inject(RestBindings.Http.RESPONSE)
    private readonly response: Response,
  ) {
    this.html = fs.readFileSync(
      path.join(__dirname, '../../public/index.html'),
      'utf-8',
    );
    // Replace base path placeholder from env
    this.html = this.html.replace(
      /\$\{basePath\}/g,
      process.env.BASE_PATH ?? '',
    );
  }

  @authorize({permissions: ['*']})
  @get('/', {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Home Page',
        content: {'text/html': {schema: {type: 'string'}}},
      },
    },
  })
  @oas.visibility(OperationVisibility.UNDOCUMENTED)
  homePage() {
    this.response.status(STATUS_CODE.OK).contentType('html').send(this.html);
    return this.response;
  }
}
