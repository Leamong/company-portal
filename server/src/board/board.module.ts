import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { Post, PostSchema } from './schemas/post.schema';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import {
  BoardReadState,
  BoardReadStateSchema,
} from './schemas/board-read-state.schema';
import { Department, DepartmentSchema } from '../departments/schemas/department.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { StorageModule } from '../storage/storage.module';
import { MessengerModule } from '../messenger/messenger.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: BoardReadState.name, schema: BoardReadStateSchema },
      { name: User.name, schema: UserSchema },
    ]),
    StorageModule,
    forwardRef(() => MessengerModule),
  ],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
