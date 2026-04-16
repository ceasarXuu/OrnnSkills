# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.1.11 (2026-04-16)


### ⚡ Performance

* **dashboard:** avoid redundant snapshot broadcasts ([4bf8ead](https://github.com/ceasarXuu/OrnnSkills/commit/4bf8ead2eeaef10b0ef6f32310b0383c0d3eb217))


### ♻️ Code Refactoring

* architecture review — correctness, dedup, dead-code removal ([3be7175](https://github.com/ceasarXuu/OrnnSkills/commit/3be7175b0f0e64ddb9a9866b0db278c9ad37247a))
* centralize window analysis outcomes ([38c32dd](https://github.com/ceasarXuu/OrnnSkills/commit/38c32dd25a4804bfa99bac04cb66bc43ea7af424))
* **core:** remove unused phase5 integration shell ([797840f](https://github.com/ceasarXuu/OrnnSkills/commit/797840f5586907e2ac8d9f91783681b307c56f3e))
* **dashboard:** centralize daemon activity copy ([23487b4](https://github.com/ceasarXuu/OrnnSkills/commit/23487b4cc4ba9b46a0e269146f1a0fe71ec4fa38))
* extract activity event building ([29cd8e2](https://github.com/ceasarXuu/OrnnSkills/commit/29cd8e2ca173bc981085a2746ec612fdf9b7b0b8))
* extract shadow bootstrapper ([116a6ba](https://github.com/ceasarXuu/OrnnSkills/commit/116a6bada25c760243a16d3fc9cf674dc4dbe8c3))
* improve stability, robustness and usability ([88c50dc](https://github.com/ceasarXuu/OrnnSkills/commit/88c50dc9bc1895f4ab0152d09569fdfe50aa7c22))
* **isolation:** scope shadows by runtime across registry, db and cli ([2472eee](https://github.com/ceasarXuu/OrnnSkills/commit/2472eeeeda5dda170fa0a746c8d30c808b2b32a6))
* logging system overhaul — context, metadata, traceability ([1e94f07](https://github.com/ceasarXuu/OrnnSkills/commit/1e94f078ce846ecdf00cdfc860bbbe0a60199a3e))
* rebuild pipeline on session windows ([d8949e9](https://github.com/ceasarXuu/OrnnSkills/commit/d8949e9eaa5bc518cdb1a1a3574817808e7a88c3))
* rename project from EVOSkills to OrnnSkills ([ee236f7](https://github.com/ceasarXuu/OrnnSkills/commit/ee236f77fbd25ed1ab5ef7a3cacf7b37e87ffe4c))
* separate task episode policy ([b9f570a](https://github.com/ceasarXuu/OrnnSkills/commit/b9f570a58ba8edc5b2939ac442d65d76acc9d92b))
* share session window recovery ([90d94ac](https://github.com/ceasarXuu/OrnnSkills/commit/90d94acc72fd29da9a8492d790d3f52201875e99))
* share window analysis coordination ([6ed8322](https://github.com/ceasarXuu/OrnnSkills/commit/6ed8322924186fd3c08e5b6f87ce14d02e7a8d41))
* simplify activity event semantics ([40df50e](https://github.com/ceasarXuu/OrnnSkills/commit/40df50e7c37382b0ab0b676fe2f238e54fa371dd))
* **skills:** 运行时维度收敛来源并保持项目优先写回 ([0729245](https://github.com/ceasarXuu/OrnnSkills/commit/07292455fcbfcdbca53b8c9c01a75e22440afec8))
* split analysis and optimization workflow ([a6918c5](https://github.com/ceasarXuu/OrnnSkills/commit/a6918c56baed23705f99284971ba5776d1cf48b4))
* third-round review fixes — architecture, types, resource safety ([0c57d89](https://github.com/ceasarXuu/OrnnSkills/commit/0c57d89fb9605aa77c83c1eb5456a6c90105bafd))
* unify analysis flow around llm window triage ([dbc3fef](https://github.com/ceasarXuu/OrnnSkills/commit/dbc3fefd25e8703aa89fe3c376494063ead417f8))


### ✨ Features

* **activity:** open skills from trace rows ([171c4e8](https://github.com/ceasarXuu/OrnnSkills/commit/171c4e871a9a89ed87055d8363885aa23f0ad6c2))
* **activity:** restore raw trace detail tools ([ad69033](https://github.com/ceasarXuu/OrnnSkills/commit/ad690330fc9346c23faba7d83a33ec96de3309c0))
* **analysis:** restore deep analysis and explanation chain ([300e882](https://github.com/ceasarXuu/OrnnSkills/commit/300e882906f00ff11719cb01541c240c3f61b9dd))
* canonicalize activity business events ([d2b9965](https://github.com/ceasarXuu/OrnnSkills/commit/d2b9965d5107cad5817402a3f1951db37ca7b957))
* **cli:** add ornn logs --clear to clear log files with confirmation ([45d7ea0](https://github.com/ceasarXuu/OrnnSkills/commit/45d7ea0665f9d0e40efab5d38a113c0ed106d3da))
* **cli:** add top-level 'ornn status' command for overall status view ([384f008](https://github.com/ceasarXuu/OrnnSkills/commit/384f0085c672e3b007c59bc601e7df96e51fe05c))
* complete Phase 1-3 implementation ([cb44122](https://github.com/ceasarXuu/OrnnSkills/commit/cb441220e5ccd4ef2462339e2ee0865bd29e3770))
* complete Phase 4 - Evaluator & Patch Generator ([ad5a0f9](https://github.com/ceasarXuu/OrnnSkills/commit/ad5a0f91787aebe18b81276f74913fe1f54e38b6))
* complete Phase 5 - Shadow Manager & Auto Cycle ([da4e45d](https://github.com/ceasarXuu/OrnnSkills/commit/da4e45dd4f9146d6439c75cb4ecfe99fb5a15d29))
* complete Phase 6 - Rollback & CLI ([77fb4cc](https://github.com/ceasarXuu/OrnnSkills/commit/77fb4ccdcb2a04296aaf8de19e90c1428b81ea1d))
* complete Phase 7 - CLI Enhancement & Integration ([52b92e6](https://github.com/ceasarXuu/OrnnSkills/commit/52b92e650c475c8a37b926a90a8f7286e5fd802f))
* complete Phase 8 - Testing & Packaging ([45dc751](https://github.com/ceasarXuu/OrnnSkills/commit/45dc7511b62c170eb7499a34f26b69453fecccda))
* comprehensive updates across project modules - config, CLI, core, utils, and tests ([e3b2f72](https://github.com/ceasarXuu/OrnnSkills/commit/e3b2f728506fd8b815207ad0ce18c46adf3664c7))
* **config:** restore dashboard config controls ([52e93f3](https://github.com/ceasarXuu/OrnnSkills/commit/52e93f3fff36aee3393d9fb24b626345687ee3b4))
* **config:** 增加provider连通性检查并复用litellm调用 ([9f54e8f](https://github.com/ceasarXuu/OrnnSkills/commit/9f54e8f1dc2a150298101e4373fb1c1717c9c0b8))
* **config:** 简化dashboard配置并校验providers JSON ([0ea3237](https://github.com/ceasarXuu/OrnnSkills/commit/0ea3237fda02d76ae3fb72371fbab452a5e58ad4))
* **dashboard:** add layered activity view with Ornn business events ([8653ecc](https://github.com/ceasarXuu/OrnnSkills/commit/8653ecc7e58922caedcc1b318e4fca0a04a5c25e))
* **dashboard:** add provider startup health warning banner ([ca5cf1b](https://github.com/ceasarXuu/OrnnSkills/commit/ca5cf1b2e706d13b64ad860f8608a46da7c69d2a))
* **dashboard:** add runtime tabs to filter shadow skills by codex/claude/opencode ([2591d4f](https://github.com/ceasarXuu/OrnnSkills/commit/2591d4f2e1683fa313737ec5af010330f2ba8f27))
* **dashboard:** auto-detect browser language with en fallback ([a2ad289](https://github.com/ceasarXuu/OrnnSkills/commit/a2ad289ed907fe7e41ada92f559fea5635f6904d))
* **dashboard:** optimize skills card layout with grid, search and sort features ([61efd99](https://github.com/ceasarXuu/OrnnSkills/commit/61efd99a914fbafbd746da5bd93eb2bf91aa2f03))
* **dashboard:** recover cost and activity panels ([ee7eff3](https://github.com/ceasarXuu/OrnnSkills/commit/ee7eff39e091f25d85c49ab08725b1d3075171ec))
* **dashboard:** replace provider json with gui editor ([7a05187](https://github.com/ceasarXuu/OrnnSkills/commit/7a051872230cd75dd64335b3977cd2a130c37165))
* **dashboard:** restore localized dashboard copy ([7218d1b](https://github.com/ceasarXuu/OrnnSkills/commit/7218d1bf571a604b6c7b0f2897a97394d72d7569))
* **dashboard:** restore overview analytics ([d712efd](https://github.com/ceasarXuu/OrnnSkills/commit/d712efde64684be4886d24765cfbbe8a07816401))
* **dashboard:** restore rich cost analytics ([4c94738](https://github.com/ceasarXuu/OrnnSkills/commit/4c94738860086f2ea8a0950efdb0117f7d9574ab))
* **dashboard:** source provider catalog from litellm registry ([af339a2](https://github.com/ceasarXuu/OrnnSkills/commit/af339a2595d8fa0ae6442ee7b7351e2482f9d6d8))
* **dashboard:** split main view into 4 sub tabs ([91ac217](https://github.com/ceasarXuu/OrnnSkills/commit/91ac21756dbf75c9d2338fd7448baa4a6cc0493d))
* **dashboard:** 技能卡片整卡点击打开详情并移除查看按钮 ([8f72d6b](https://github.com/ceasarXuu/OrnnSkills/commit/8f72d6b8fe6af03dcaaf5d9bdf8ee4c735d69d59))
* **dashboard:** 支持技能弹窗编辑保存并自动创建新版本 ([6d827ba](https://github.com/ceasarXuu/OrnnSkills/commit/6d827ba784e8380b64dfdfaaab5a944ec48e31a0))
* **dashboard:** 新增配置tab支持provider与runtime sync可视化编辑 ([cbbf739](https://github.com/ceasarXuu/OrnnSkills/commit/cbbf739c8694786b30e89871a64e8091478f5db2))
* **dashboard:** 配置tab补充字段说明文案 ([e62278e](https://github.com/ceasarXuu/OrnnSkills/commit/e62278e2755a3e420fc2c70a3dbe1274b19633f4))
* **llm:** harden json analysis responses ([c330a10](https://github.com/ceasarXuu/OrnnSkills/commit/c330a106f8519f36ad641ec01e1c0b2ba49d89d0))
* make daemon monitor all initialized projects ([f5367d8](https://github.com/ceasarXuu/OrnnSkills/commit/f5367d87cc9b983aace4af57dfca015e336308ed))
* make dashboard config global ([35ed8d7](https://github.com/ceasarXuu/OrnnSkills/commit/35ed8d77bc343cf6f325044d20dea40c4672a3c1))
* redesign activity business observability ([df3aeda](https://github.com/ceasarXuu/OrnnSkills/commit/df3aedad265dd3169d2160afcb25718f7f776678))
* refactor activity dashboard around scope timelines ([14ebb63](https://github.com/ceasarXuu/OrnnSkills/commit/14ebb638902cb6930c6a85eb70fa6aa5e275e157))
* refine cost dashboard layout ([f411e0f](https://github.com/ceasarXuu/OrnnSkills/commit/f411e0f7894fa22bf031fa5b3f921f16f1258225))
* **tracking:** restore decision event production ([46aa704](https://github.com/ceasarXuu/OrnnSkills/commit/46aa7041900686f92773e7a74064a81dba044594))
* **tracking:** restore task episodes and probe events ([b3a4051](https://github.com/ceasarXuu/OrnnSkills/commit/b3a405154b6c5d6a88c06c1b4024b1260a56a4d6))
* 增强安全性和性能优化 ([b5a5240](https://github.com/ceasarXuu/OrnnSkills/commit/b5a52402bd35befb0995e66a40f149f00a154feb))
* 实现 TraceSkillMapper 核心模块解决 trace 到 skill 映射问题 ([4ba6c05](https://github.com/ceasarXuu/OrnnSkills/commit/4ba6c05c717a53c1c6d2aedf7f3fa03dc10b0a4a))
* 新增技能同步功能与多模型支持 ([c623748](https://github.com/ceasarXuu/OrnnSkills/commit/c623748cb35dc119935c0e0c68d80156ff88d77b))
* 添加 Observer 集成模块和完整文档 ([1061e36](https://github.com/ceasarXuu/OrnnSkills/commit/1061e360893088634882459647a0db9d57697661))
* 添加CI工作流并优化日志级别 ([c8cfa87](https://github.com/ceasarXuu/OrnnSkills/commit/c8cfa87e077b0bf19d997239ca9799652ea95e15))


### 📝 Documentation

* add comprehensive user guide in Chinese ([1ca0827](https://github.com/ceasarXuu/OrnnSkills/commit/1ca0827b52f42c2cefc066c1ade62c6526417bf7))
* add repo presentation pack for 20260408 ([2d804e9](https://github.com/ceasarXuu/OrnnSkills/commit/2d804e917b53c90d5c3953ccb01f374f92111ce0))
* add repo summary pack for 2026-04-08 ([5dd2038](https://github.com/ceasarXuu/OrnnSkills/commit/5dd2038f204983c147df6d8f99653905c720e1d4))
* fix remaining 'evo' references in PRD.md ([3c13d75](https://github.com/ceasarXuu/OrnnSkills/commit/3c13d750c5c9dec3d9f821299517667654570e7f))
* record cli reinstall workflow ([61f5bc2](https://github.com/ceasarXuu/OrnnSkills/commit/61f5bc2929b6b00b147ac2513c5166b0c77706cc))
* update README to reflect EVOSkills branding and evo CLI ([f15fb5a](https://github.com/ceasarXuu/OrnnSkills/commit/f15fb5acbcf1f662da5d5028d2aabdf5101c73e3))
* 改进快速开始部分 ([c0ba094](https://github.com/ceasarXuu/OrnnSkills/commit/c0ba094585828740b02e337089e852d028968d39))
* 更新README文档以反映最新CLI命令 ([3c1a1f3](https://github.com/ceasarXuu/OrnnSkills/commit/3c1a1f387896f31a7662de37eb5a35a45df20854))
* 更新文档添加trace-skill映射和自动优化说明 ([b42074c](https://github.com/ceasarXuu/OrnnSkills/commit/b42074cc20eb062c7cea25084cc59346c947c027))


### 🐛 Bug Fixes

* **activity:** localize realtime timestamps ([da4cd64](https://github.com/ceasarXuu/OrnnSkills/commit/da4cd6467088708bcff3d5037e0ca930fbf4a5aa))
* **activity:** recover realtime trace ingestion ([c7ff6db](https://github.com/ceasarXuu/OrnnSkills/commit/c7ff6db1d58992c695d79018159dd92c432d4ce4))
* **activity:** restore legacy event labels ([7f92cc7](https://github.com/ceasarXuu/OrnnSkills/commit/7f92cc78519d5a14f61dddb97373f32309add43a))
* **activity:** sync processed trace status ([0e58f3f](https://github.com/ceasarXuu/OrnnSkills/commit/0e58f3f78bdba2ce4b8e592516349888c577978b))
* **analyzer:** 移除LLMAnalyzerAgent中的TODO注释 ([52cfbdd](https://github.com/ceasarXuu/OrnnSkills/commit/52cfbdd17301a4d32d595acf69705d1b1ec14bc2))
* avoid invalid prune-noise optimization errors ([4464e23](https://github.com/ceasarXuu/OrnnSkills/commit/4464e230c87d777feca278a69e663cd8dde270af))
* clarify dashboard activity flow semantics ([97b5328](https://github.com/ceasarXuu/OrnnSkills/commit/97b53282643949f79795f568d6a82c4617fb9d55))
* **cli:** preserve executable bit for local binary ([78cee3f](https://github.com/ceasarXuu/OrnnSkills/commit/78cee3fed23c0200e27fd7eb366dab80920dfa89))
* **cli:** rewrite logs command for readability and fix double-output ([74cabc8](https://github.com/ceasarXuu/OrnnSkills/commit/74cabc80ed602e456556f7d45ab84f78558c4100))
* close review gaps in window analysis orchestration ([0f1f111](https://github.com/ceasarXuu/OrnnSkills/commit/0f1f111e1dee5f55bfba2cbfbe86c033d3f46ba6))
* **config:** accept provider api keys in dashboard gui ([478788d](https://github.com/ceasarXuu/OrnnSkills/commit/478788d45f9b5c32b05fefc2e012e68f9d121111))
* **config:** align dashboard config copy with actual paths ([af54163](https://github.com/ceasarXuu/OrnnSkills/commit/af541636d2675b74b0ea8fd4446d89400276cc12))
* **config:** auto-save provider settings ([ac87ec7](https://github.com/ceasarXuu/OrnnSkills/commit/ac87ec7d6f1e9af0d93ed10faf8ac4988bfb0c3a))
* **config:** fallback when litellm catalog is unavailable ([d3e939b](https://github.com/ceasarXuu/OrnnSkills/commit/d3e939b88cf18650e7a60e2cbdc7bf7015a891b7))
* **config:** improve provider-not-found error messages with actionable guidance ([498e199](https://github.com/ceasarXuu/OrnnSkills/commit/498e19970c9299d6accac0a2c64bffce81fc4321))
* **config:** move connectivity check to provider rows ([a771443](https://github.com/ceasarXuu/OrnnSkills/commit/a771443ed61a24ea62a95a33d87d75773bdc79e3))
* **config:** normalize built-in model ids ([bee6c02](https://github.com/ceasarXuu/OrnnSkills/commit/bee6c02bcec4d54d4bdd11e9e60916e54666602f))
* **config:** remove mutable strategy toggles ([79043bc](https://github.com/ceasarXuu/OrnnSkills/commit/79043bc97e7f0c032590a2d04d50120580565d7c))
* **config:** remove reverted default provider controls ([9b015f8](https://github.com/ceasarXuu/OrnnSkills/commit/9b015f853ac9f2af98fea84f80639ac802e93571))
* **config:** restore row-level provider toggle ([07c10f4](https://github.com/ceasarXuu/OrnnSkills/commit/07c10f4c950bede9db7531d8eee507ce7b17b932))
* **config:** show plain api keys in dashboard ([d71120a](https://github.com/ceasarXuu/OrnnSkills/commit/d71120af8e9405f5adbcf7a9834565a2b16aa497))
* **config:** use provider probe for connectivity checks ([18c4249](https://github.com/ceasarXuu/OrnnSkills/commit/18c42493e73f488bf4d2e7aee8df1e9d861880e5))
* **daemon:** honor dashboard lang and use portable background entry path ([f03e974](https://github.com/ceasarXuu/OrnnSkills/commit/f03e97491697f70af5354ffe8da6b462be121d3d))
* **dashboard:** add build/runtime observability and config API diagnostics ([37a4212](https://github.com/ceasarXuu/OrnnSkills/commit/37a4212a1045511d12ba2481541bbe52042b1851))
* **dashboard:** auto-recover stale bootstrap state ([69ceb29](https://github.com/ceasarXuu/OrnnSkills/commit/69ceb2957ffe20ac2e853e21aafde188f4e03db5))
* **dashboard:** clarify analysis failure details ([2d798bc](https://github.com/ceasarXuu/OrnnSkills/commit/2d798bc67b09a9b9a8e341efd6a78fee505f4edd))
* **dashboard:** guard panel render failures ([a494e5c](https://github.com/ceasarXuu/OrnnSkills/commit/a494e5c48adb5a5754bd3e45cc4151e3f2d8bfaa))
* **dashboard:** harden auto locale detection to avoid init stalls ([fb9dcf4](https://github.com/ceasarXuu/OrnnSkills/commit/fb9dcf40315b5c0352d9a720970613a2e1d6f8b0))
* **dashboard:** keep skill search focus during live updates ([4a090fd](https://github.com/ceasarXuu/OrnnSkills/commit/4a090fd34b18fa50fb17a3e572d744e199118332))
* **dashboard:** localize activity detail labels ([e4f0273](https://github.com/ceasarXuu/OrnnSkills/commit/e4f0273719309aa4ee31b2ce38a86225ee35f479))
* **dashboard:** make config loading non-blocking and retryable ([b2f7357](https://github.com/ceasarXuu/OrnnSkills/commit/b2f7357d352fb7b22eb51c1931f7cae31a5530ad))
* **dashboard:** make init self-heal and auto-recover via SSE ([cd8fa17](https://github.com/ceasarXuu/OrnnSkills/commit/cd8fa1775bd69488abbc83c14b7b531a05f3b9d2))
* **dashboard:** persist language preference for analysis ([955cf2e](https://github.com/ceasarXuu/OrnnSkills/commit/955cf2ebf5e29ac189e1c119d55c82e50eeeb8f7))
* **dashboard:** prevent search input from losing focus on typing ([ad5d7e1](https://github.com/ceasarXuu/OrnnSkills/commit/ad5d7e18e30dfe6b62085462d56be049e8e5c9e5))
* **dashboard:** remove shadow content from snapshots and slim shadow index ([0a1ae2f](https://github.com/ceasarXuu/OrnnSkills/commit/0a1ae2f8bd0c4fd717166c24f796750610dc3907))
* **dashboard:** show full local timestamps in activity ([68ddce2](https://github.com/ceasarXuu/OrnnSkills/commit/68ddce209235618f0d19f3e3156486391908f065))
* **dashboard:** skip full panel rerender while skill search is focused ([0ebdac4](https://github.com/ceasarXuu/OrnnSkills/commit/0ebdac47a9acc023644cb64258f96548514196de))
* **dashboard:** 保存后自动部署最新版本到对应runtime ([7da609b](https://github.com/ceasarXuu/OrnnSkills/commit/7da609b42296a53c8c288f6bf354b5efe653e716))
* **dashboard:** 修复前端转义函数导致脚本崩溃 ([4ca47fa](https://github.com/ceasarXuu/OrnnSkills/commit/4ca47fa7d0c770591c7e9c170ad73eca65f9e3ef))
* **dashboard:** 修复技能详情卡片加载失败并补齐诊断日志 ([e9ede02](https://github.com/ceasarXuu/OrnnSkills/commit/e9ede02c4e3c1ee31aef49b0fa2d93867e482570))
* **dashboard:** 初始化解耦日志加载并加请求超时防卡死 ([614fe3d](https://github.com/ceasarXuu/OrnnSkills/commit/614fe3dcb0fed7917a580221eee647439f48c472))
* **dashboard:** 缩减snapshot/sse trace字段避免加载卡死 ([ded14f0](https://github.com/ceasarXuu/OrnnSkills/commit/ded14f0e493cc186545d81c4d9e8cb2460e32442))
* **dashboard:** 调整技能编辑弹窗布局占满可用高度 ([34d6edf](https://github.com/ceasarXuu/OrnnSkills/commit/34d6edf19b54c6da54787e025836eccbe590febe))
* dedupe repeated activity conclusions ([9650c81](https://github.com/ceasarXuu/OrnnSkills/commit/9650c81cc9687faa081abeb33b02652ee83a486d))
* harden invalid analysis json handling ([96fc955](https://github.com/ceasarXuu/OrnnSkills/commit/96fc955146737b75745159769868bca1f1625b40))
* harden structured llm response handling ([239e272](https://github.com/ceasarXuu/OrnnSkills/commit/239e272945bc4740cae187439701a9dcb7bfbb63))
* harden window candidate and analysis validation ([53f92bf](https://github.com/ceasarXuu/OrnnSkills/commit/53f92bf2ccf3674d62f43d6f1ca11175997f4d78))
* **i18n:** refine zh dashboard copy ([1513653](https://github.com/ceasarXuu/OrnnSkills/commit/1513653119aea8a773a2985169a5074751f2260d))
* **i18n:** unify dashboard zh terminology ([75ca33a](https://github.com/ceasarXuu/OrnnSkills/commit/75ca33a1402b0b61b01005091980778c4a8633d8))
* ignore stale daemon failure backfill ([31d381d](https://github.com/ceasarXuu/OrnnSkills/commit/31d381d9a61f4f1c785b1a8fc50bda04229e0e34))
* **journal:** add null guard in queueWrite callback to prevent crash on DB close ([a6d9745](https://github.com/ceasarXuu/OrnnSkills/commit/a6d9745a131507c1166d0c28c510cf7a32654ad2))
* **journal:** restore revision and snapshot compatibility ([2691c64](https://github.com/ceasarXuu/OrnnSkills/commit/2691c64a6769e783285bc90667854d64edad2e0d))
* keep feedback off analysis-started rows ([66809d7](https://github.com/ceasarXuu/OrnnSkills/commit/66809d79e1f0d8d104af10c08fef9df78ec6bf14))
* limit npm package contents ([f898965](https://github.com/ceasarXuu/OrnnSkills/commit/f898965d2d55f023a1510ff70d6dae6d25ad69b7))
* localize zh activity narratives ([c4b22de](https://github.com/ceasarXuu/OrnnSkills/commit/c4b22de74cce7502ba30382f4abb8b995273b991))
* migrate legacy dashboard model config ([bba4a73](https://github.com/ceasarXuu/OrnnSkills/commit/bba4a731d72f719b5083697de10f3d196ed6ae5f))
* **monitor:** bootstrap skills and map exec_command skill usage ([2bd66e0](https://github.com/ceasarXuu/OrnnSkills/commit/2bd66e021fec2165ef0b313c5d61bc3c92c0402d))
* **observer:** incremental codex session processing to stop cpu spikes ([502657e](https://github.com/ceasarXuu/OrnnSkills/commit/502657e46a2d91c9e084ffd62b3ded4e7961ca2f))
* recover live trace ingestion and probe triggering ([6359303](https://github.com/ceasarXuu/OrnnSkills/commit/63593030ad9d7ebbf7cac67ee0b236c8bc9e6b40))
* **recovery:** rebuild deleted local analysis modules ([0edcc59](https://github.com/ceasarXuu/OrnnSkills/commit/0edcc595517cf42767be0af83d78f7f31bf15e0b))
* reduce dashboard bootstrap load ([0f2e0fa](https://github.com/ceasarXuu/OrnnSkills/commit/0f2e0facb6e364a66d90640fb454ce3a50d06a3f))
* reduce observer and dashboard warning noise ([c751e60](https://github.com/ceasarXuu/OrnnSkills/commit/c751e606fac96ed4f9f36250475cbfd13d63e496))
* remove trace-only skill observed rows ([5de5c9a](https://github.com/ceasarXuu/OrnnSkills/commit/5de5c9a7fdae38ad146323662fd7be83afb6096d))
* restore codex skill ref extraction ([324a85d](https://github.com/ceasarXuu/OrnnSkills/commit/324a85d20b72c24cffeff1b82ac923f8313c8670))
* scope manual optimization workflow ([a0493d3](https://github.com/ceasarXuu/OrnnSkills/commit/a0493d383a7c3844b85ab4be2d4aeb7793bcb941))
* second review — complete error handling unification and lint cleanup ([1b63130](https://github.com/ceasarXuu/OrnnSkills/commit/1b63130c982542e1c5dad382aa8490c611a85df8))
* **shadow-manager:** 项目与全局同扫并按项目优先处理同名skill ([72171ae](https://github.com/ceasarXuu/OrnnSkills/commit/72171ae11d78c6822b4dc99ca62a5f42bc989d3e))
* **skills:** 全局skill自动物化到项目目录并按项目路径部署 ([ffcbab9](https://github.com/ceasarXuu/OrnnSkills/commit/ffcbab958ecf060486112ac1fb5fffa08c3a086a))
* stabilize codex observer bootstrap ([994053f](https://github.com/ceasarXuu/OrnnSkills/commit/994053f37f4dd1ee701704dcf24719a7a1800543))
* sync task episodes with session windows ([d7b5ca2](https://github.com/ceasarXuu/OrnnSkills/commit/d7b5ca26713d72fe3b35bf75d36a2b9ff2ff1b8f))
* **trace:** recover stale ndjson lock and auto-create missing sessions ([873306c](https://github.com/ceasarXuu/OrnnSkills/commit/873306c6ce1b65a6429998738d81f655b20204e8))
* track codex skill calls from tool paths ([99b43fa](https://github.com/ceasarXuu/OrnnSkills/commit/99b43fa76c9b5f7213cee8b12bfb0a6f0c69b8ce))
* **tracking:** unstick live trace updates ([cd24c89](https://github.com/ceasarXuu/OrnnSkills/commit/cd24c89f7fdefca61d1e7e0ee0862db33ac6f412))
* unify dashboard token units ([664e376](https://github.com/ceasarXuu/OrnnSkills/commit/664e3763c90c42738f2b3d920d031e9c786b6040))
* 修复TypeScript类型错误和ESLint代码质量问题 ([8672899](https://github.com/ceasarXuu/OrnnSkills/commit/8672899b98809cdaad8750ea96a4279dc4fbbfc0))
* 统一宿主术语文案 ([263a0bf](https://github.com/ceasarXuu/OrnnSkills/commit/263a0bf45a0a1e803a94b2b60adb2f8ff0358a2e))

## [0.1.10] (2026-04-03)

### Features
* 添加CI工作流并优化日志级别
* 新增API密钥验证器，支持15+个LLM提供商
* 新增错误助手模块，提供详细的错误诊断和建议
* 新增配置管理器，支持多提供商配置
* 新增交互式选择器

### Bug Fixes
* 修复SQLite事务错误处理
* 修复Journal持久化错误
* 移除analyzer-agent.ts中的TODO注释

### Documentation
* 更新README文档以反映最新CLI命令
* 添加npm版本徽章
* 修正CLI命令列表

### Code Refactoring
* 优化日志脱敏功能
* 改进Daemon模块的重试队列内存使用
* 优化数据库连接管理

### Tests
* 新增20+个单元测试文件
* 测试覆盖率阈值设置: Lines 60%, Functions 60%, Branches 45%, Statements 60%
* 304个测试全部通过

### Chores
* 清理项目配置文件和自动生成文档
* 更新.gitignore文件添加OrnnSkills相关配置
* 移除不应提交的运行时文件

---

## [0.1.9] (2026-04-02)

### Features
* 初始版本发布
* 实现核心功能：智能观察、精准映射、自动优化
* 支持Codex/OpenCode/Claude等Agent
* 实现影子副本和回滚支持
