import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { organizeDiaryWithSiliconFlow, generateMonthlyReviewWithSiliconFlow } from "./siliconflow";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // AI 日记服务
  diary: router({
    organize: publicProcedure
      .input(z.object({ rawInput: z.string(), date: z.string() }))
      .mutation(async ({ input }) => {
        return await organizeDiaryWithSiliconFlow(input.rawInput);
      }),
    generateReview: publicProcedure
      .input(z.object({
        entries: z.array(z.object({
          date: z.string(),
          mainEvent: z.string(),
          energy: z.number(),
          gains: z.string(),
          nextDayPlans: z.array(z.any()),
          wantToDo: z.array(z.any()),
          longTermPlans: z.array(z.any()),
        })),
        year: z.number(),
        month: z.number(),
      }))
      .mutation(async ({ input }) => {
        const diaryEntries = input.entries.map(entry => ({
          date: entry.date,
          mainEvent: entry.mainEvent,
          memories: [],
          energyLevel: entry.energy,
          insights: entry.gains,
        }));
        const result = await generateMonthlyReviewWithSiliconFlow(diaryEntries);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
