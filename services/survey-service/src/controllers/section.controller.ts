import {inject, service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
  post,
  HttpErrors,
} from '@loopback/rest';
import {CONTENT_TYPE, ILogger, LOGGER, STATUS_CODE} from '@sourceloop/core';
import {authenticate, STRATEGY} from 'loopback4-authentication';
import {authorize} from 'loopback4-authorization';
import {Section} from '../models';
import {SectionRepository} from '../repositories/section.repository';
import {SurveyQuestionRepository} from '../repositories/survey-question.repository';
import {SectionService} from '../services/section.service';
import {PermissionKey} from '../enum/permission-key.enum';
import {
  SectionRepository as SectionSequelizeRepo,
  SurveyQuestionRepository as SurveyQuestionSequelizeRepo,
} from '../repositories/sequelize';
const basePath = '/surveys/{surveyId}/sections';
const orderByCreatedOn = 'created_on DESC';

export class SectionController {
  constructor(
    @repository(SectionRepository)
    public sectionRepository: SectionRepository | SectionSequelizeRepo,
    @repository(SurveyQuestionRepository)
    public surveyQuestionRepository:
      | SurveyQuestionRepository
      | SurveyQuestionSequelizeRepo,

    @service(SectionService)
    public sectionService: SectionService,
    @inject(LOGGER.LOGGER_INJECT) public logger: ILogger,
  ) {}

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [PermissionKey.CreateSurveySection],
  })
  @post(basePath)
  @response(STATUS_CODE.OK, {
    description: 'Section model instance',
    content: {[CONTENT_TYPE.JSON]: {schema: getModelSchemaRef(Section)}},
  })
  async create(
    @requestBody({
      content: {
        [CONTENT_TYPE.JSON]: {
          schema: getModelSchemaRef(Section, {
            title: 'NewSection',
            exclude: ['id'],
          }),
        },
      },
    })
    section: Omit<Section, 'id'>,
    @param.path.string('surveyId') surveyId: string,
  ): Promise<Section> {
    await this.sectionService.checkBasicSectionValidation(surveyId);
    const existingSections = await this.sectionRepository.count({
      surveyId,
    });
    section.surveyId = surveyId;
    section.name = section.name ?? 'Untitled Section';
    section.displayOrder = existingSections.count + 1;
    await this.sectionRepository.create(section);

    // fetch createdSection with id
    const createdSection = await this.sectionRepository.findOne({
      order: [orderByCreatedOn],
      where: {surveyId},
    });
    if (!createdSection) {
      throw new HttpErrors.NotFound();
    }

    if (!existingSections.count) {
      this.surveyQuestionRepository
        .updateAll({sectionId: createdSection.id}, {surveyId})
        .then()
        .catch(error => {
          throw new Error(error);
        });
    }
    return createdSection;
  }

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [PermissionKey.ViewSurveySection],
  })
  @get(`${basePath}/count`)
  @response(STATUS_CODE.OK, {
    description: 'Section model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(@param.where(Section) where?: Where<Section>): Promise<Count> {
    return this.sectionRepository.count(where);
  }

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [
      PermissionKey.ViewSurveySection,
      PermissionKey.ViewOpenSurveySection,
    ],
  })
  @get(`${basePath}`)
  @response(STATUS_CODE.OK, {
    description: 'Array of Section model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Section, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.path.string('surveyId') surveyId: string,
    @param.filter(Section) filter?: Filter<Section>,
  ): Promise<Section[]> {
    return this.sectionRepository.find(filter);
  }

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [PermissionKey.ViewSurveySection],
  })
  @get(`${basePath}/{id}`)
  @response(STATUS_CODE.OK, {
    description: 'Section model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Section, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.path.string('surveyId') surveyId: string,
    @param.filter(Section, {exclude: 'where'})
    filter?: FilterExcludingWhere<Section>,
  ): Promise<Section> {
    const section = await this.sectionRepository.findOne({
      ...filter,
      where: {id, surveyId},
    });
    if (!section) {
      throw new HttpErrors.BadRequest('Entity not found');
    }
    return section;
  }

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [PermissionKey.UpdateSurveySection],
  })
  @patch(`${basePath}/{id}`)
  @response(STATUS_CODE.NO_CONTENT, {
    description: 'Section PATCH success',
  })
  async updateById(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Section, {partial: true}),
        },
      },
    })
    section: Partial<Section>,
    @param.path.string('surveyId') surveyId: string,
    @param.path.string('id') id: string,
  ): Promise<void> {
    await this.sectionService.checkBasicSectionValidation(surveyId);

    // so that these parameters can not be passed in request body
    section.surveyId = surveyId;
    const updatedCount = await this.sectionRepository.updateAll(section, {
      id,
      surveyId,
    });
    if (updatedCount.count === 0) {
      throw new HttpErrors.BadRequest('Entity not found.');
    }
  }

  @authenticate(STRATEGY.BEARER, {
    passReqToCallback: true,
  })
  @authorize({
    permissions: [PermissionKey.DeleteSurveySection],
  })
  @del(`${basePath}/{id}`)
  @response(STATUS_CODE.NO_CONTENT, {
    description: 'Section DELETE success',
  })
  async deleteById(
    @param.path.string('surveyId') surveyId: string,
    @param.path.string('id') sectionId: string,
  ): Promise<void> {
    await this.sectionService.handleDeleteSection(surveyId, sectionId);

    const deleteCount = await this.sectionRepository.deleteAllHard({
      id: sectionId,
      surveyId,
    });
    if (deleteCount.count === 0) {
      throw new HttpErrors.BadRequest('Entity not found.');
    }
  }
}
