import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { Repository } from 'typeorm';
import { SearchPostDto } from './dto/search-post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostEntity)
    private repository: Repository<PostEntity>,
  ) {}

  create(dto: CreatePostDto, userId: number) {
    const firstParagraph = dto.body.find((obj) => obj.type === 'paragraph')
      ?.data?.text;
    return this.repository.save({
      title: dto.title,
      body: dto.body,
      tags: dto.tags,
      user: { id: userId },
      description: firstParagraph || '',
    });
  }

  findAll() {
    return this.repository.find({
      order: {
        createAt: 'DESC',
      },
    });
  }

  async getPopular() {
    const qb = this.repository.createQueryBuilder('p');
    qb.orderBy('views', 'DESC');
    qb.limit(10);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async search(dto: SearchPostDto) {
    const qb = this.repository.createQueryBuilder('p');
    qb.leftJoinAndSelect('p.user', 'user');
    qb.limit(dto.limit || 0);
    qb.take(dto.limit || 10);
    if (dto.views) {
      qb.orderBy('views', dto.views);
    }
    if (dto.body) {
      qb.andWhere(`p.body ILIKE :body`);
    }
    if (dto.title) {
      qb.andWhere(`p.title ILIKE :title`);
    }
    if (dto.tag) {
      qb.andWhere(`p.tags ILIKE :tag`);
    }
    qb.setParameters({
      body: `%${dto.body}%`,
      title: `%${dto.title}%`,
      tag: `%${dto.tag}%`,
      views: dto.views || '',
    });

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: number) {
    await this.repository
      .createQueryBuilder('posts')
      .whereInIds(id)
      .update()
      .set({
        views: () => 'views + 1',
      })
      .execute();
    return this.repository.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdatePostDto, userId: number) {
    const find = await this.repository.findOne({ where: { id } });
    if (!find) {
      throw new NotFoundException('Cтатья не найдена');
    }

    const firstParagraph = dto.body.find((obj) => obj.type === 'paragraph')
      ?.data?.text;

    return this.repository.update(id, {
      title: dto.title,
      body: dto.body,
      tags: dto.tags,
      user: { id: userId },
      description: firstParagraph || '',
    });
  }

  async remove(id: number, userId: number) {
    const find = await this.repository.findOne({ where: { id } });
    if (!find) {
      throw new NotFoundException('Cтатья не найдена');
    }
    if (find.user.id !== userId) {
      throw new ForbiddenException('Нет доступа к статье');
    }
    return this.repository.delete(id);
  }
}
