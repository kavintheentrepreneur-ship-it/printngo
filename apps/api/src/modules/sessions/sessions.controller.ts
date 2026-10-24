import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(@Inject(SessionsService) private readonly sessionsService: SessionsService) {}

  @Get(':token')
  async getSession(@Param('token') token: string) {
    return this.sessionsService.validateAndGetSession(token);
  }

  @Post(':token/files')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('token') token: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file || !file.buffer) {
      throw new HttpException(
        {
          code: 'FILE_MISSING',
          message: 'No file was uploaded. Please choose a file to upload.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.sessionsService.uploadFileForSession(
      token,
      file.buffer,
      file.originalname || 'uploaded_document',
    );
  }
}
