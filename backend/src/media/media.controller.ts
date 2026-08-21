import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  MaxFileSizeValidator,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService } from './media.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { Public, CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  UploadImageDto,
  CreateVideoDto,
  ListMediaQueryDto,
} from './dto/media.dto';

/** Hard ceiling on the raw upload before sharp compresses it. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Boat + cabin media galleries. Images are uploaded straight to Cloudflare R2
 * via a presigned URL then confirmed here; videos are YouTube links. Read is
 * public (guest-facing galleries); writes need assets:edit on the boat.
 */
@Controller('houseboats/:houseboatId/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get()
  list(
    @Param('houseboatId') houseboatId: string,
    @Query() query: ListMediaQueryDto,
  ) {
    return this.media.list(houseboatId, query.cabinId);
  }

  @Post('images')
  @RequirePermission({ module: 'profile', action: 'edit' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  uploadImage(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadImageDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: { buffer: Buffer; mimetype: string },
  ) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }
    return this.media.uploadImage(houseboatId, user.id, {
      cabinId: dto.cabinId,
      buffer: file.buffer,
      sortOrder: dto.sortOrder,
    });
  }

  @Post('logo')
  @RequirePermission({ module: 'profile', action: 'edit' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  uploadLogo(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES })],
        fileIsRequired: true,
      }),
    )
    file: { buffer: Buffer; mimetype: string },
  ) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }
    return this.media.uploadLogo(houseboatId, user.id, file.buffer);
  }

  @Delete('logo')
  @RequirePermission({ module: 'profile', action: 'edit' })
  removeLogo(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.removeLogo(houseboatId, user.id);
  }

  @Post('videos')
  @RequirePermission({ module: 'profile', action: 'edit' })
  createVideo(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVideoDto,
  ) {
    return this.media.createVideo(houseboatId, user.id, dto);
  }

  @Delete(':mediaId')
  @RequirePermission({ module: 'profile', action: 'edit' })
  remove(
    @Param('houseboatId') houseboatId: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.remove(houseboatId, user.id, mediaId);
  }
}
