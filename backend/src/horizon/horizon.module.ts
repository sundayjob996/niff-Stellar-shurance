import { Module } from "@nestjs/common";
import { HorizonController } from "./horizon.controller";
import { HorizonService } from "./horizon.service";
import { CacheModule } from "../cache/cache.module";

@Module({
  imports: [CacheModule],
  controllers: [HorizonController],
  providers: [HorizonService],
})
export class HorizonModule {}
