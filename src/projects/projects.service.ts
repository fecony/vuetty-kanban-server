import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { IProject } from './interfaces/project.interface';
import { CreateProjectDTO } from './dto/create-project.dto';
import { prepareMeta } from '../common/utils/prepare-meta.util';
import { getFormattedColumnName } from '../common/utils/column-name.utils';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel('Project') private readonly projectModel: Model<IProject>,
  ) {}

  LIMIT: number = 25;

  async getAll(page: number = 1): Promise<object> {
    try {
      const total = await this.projectModel.countDocuments();
      const projects = await this.projectModel
        .find()
        .limit(this.LIMIT)
        .skip(this.LIMIT * (page - 1))
        .exec();

      if (!projects) {
        throw new NotFoundException("Can't get projects...");
      }

      let meta = prepareMeta(page, this.LIMIT, total);
      let data = { meta, data: projects };

      return data;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async getById(ID: string): Promise<IProject> {
    try {
      const project = await this.projectModel.findById(ID).exec();

      if (!project) {
        throw new NotFoundException(`Project with id: ${ID} does not exist!`);
      }
      return project;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async create(createProjectDTO: CreateProjectDTO): Promise<IProject> {
    try {
      const newProject = await this.projectModel(createProjectDTO).save();
      return newProject;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(
    ID: string,
    createProjectDTO: CreateProjectDTO,
  ): Promise<IProject> {
    try {
      const updatedProject = await this.projectModel.findByIdAndUpdate(
        ID,
        createProjectDTO,
        { new: true },
      );
      return updatedProject;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async delete(ID: string) {
    try {
      const deletedProject = await this.projectModel.findByIdAndRemove(ID);
      if (!deletedProject) {
        throw new BadRequestException(`Project with ID: ${ID} doesn't exist`);
      }
      return { msg: 'OK' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async addColumn(ID: string, body: any): Promise<IProject> {
    let {
      column: { name, order },
    } = body;

    // Check if project exists and get last order number
    let project: any = await this.getById(ID);
    let lastOrderNum = Math.max(...project.columns.map(o => o.order), 0);

    // Values for new column
    order = order ? order : lastOrderNum + 1;
    name = getFormattedColumnName(name);

    let hasColumn = project.columns.some(
      (columnValue: { name: string }) => columnValue.name == name,
    );

    if (hasColumn) {
      throw new BadRequestException('Column Already exists');
    }

    let result = this.projectModel
      .findByIdAndUpdate({ _id: ID }, { $push: { columns: { name, order } } })
      .then(() => {
        return { ok: true };
      })
      .catch(err => {
        throw new BadRequestException(
          'Something happened when adding new column...' + err,
        );
      });

    return result;
  }

  async updateColumn(ID: string, column: string, body: any): Promise<IProject> {
    let {
      column: { name, order },
    } = body;

    let project: any = await this.getById(ID);

    column = getFormattedColumnName(column); // Old Value
    name = getFormattedColumnName(name); // New Value

    let canBeUpdated = project.columns.some(
      (columnValue: { name: string }) => columnValue.name == column,
    );

    let isAlreadyDefined = project.columns.some(
      (columnValue: { name: string }) => columnValue.name == name,
    );

    if (!canBeUpdated) {
      throw new BadRequestException(`Column ${column} doesn't exist!`);
    } else if (isAlreadyDefined) {
      throw new BadRequestException(
        `New Column name ${name} already exists in project!`,
      );
    } else {
      let currentOrder = project.columns.filter(o => o.name == column);
      order = order ? order : currentOrder[0]['order'];

      let result = this.projectModel
        .updateOne(
          { _id: ID, 'columns.name': column },
          { $set: { 'columns.$.name': name, 'columns.$.order': order } },
        )
        .then(() => {
          return { ok: true };
        })
        .catch(err => {
          throw new BadRequestException(
            'Something happened when updating column...' + err,
          );
        });

      return result;
    }
  }

  async deleteColumn(ID: string, body: any): Promise<IProject> {
    let { column } = body;
    const name = getFormattedColumnName(column);

    let project: any = await this.getById(ID);
    let hasColumn = project.columns.some(
      (c: { name: string }) => c.name == name,
    );

    if (!hasColumn) {
      throw new BadRequestException(
        `Column '${name}' doesn't exist in '${project.title}' project.`,
      );
    }

    let result = this.projectModel
      .updateOne({ _id: ID }, { $pull: { columns: { name } } })
      .then(() => {
        return { ok: true };
      })
      .catch(err => {
        throw new BadRequestException(
          'Something happened when removing column...' + err,
        );
      });

    return result;
  }
}
