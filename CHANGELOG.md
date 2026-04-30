# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.12](https://github.com/ceasarXuu/OrnnSkills/compare/v0.1.11...v0.1.12) (2026-04-30)


### ⚡ Performance

* add dashboard reader benchmarks and bounded cache ([a246fc5](https://github.com/ceasarXuu/OrnnSkills/commit/a246fc5aa10e150415383e72ebfe559f93f15448))


### 📝 Documentation

* add code quality governance plan for 2026-04 ([1e927e1](https://github.com/ceasarXuu/OrnnSkills/commit/1e927e151514e14757b9e06b753c7102597385c2))
* add docs index and mark legacy v1/v2 dashboard documents archived ([fc117bf](https://github.com/ceasarXuu/OrnnSkills/commit/fc117bf07497f11d84fadf82eaa6ee63ae1fb485))
* audit v1 and v3 dashboard gaps ([6b8f26b](https://github.com/ceasarXuu/OrnnSkills/commit/6b8f26bde80a87e4bbe25f56d4cb90f72b186ca6))
* compare darwin-skill with OrnnSkills ([e496ca8](https://github.com/ceasarXuu/OrnnSkills/commit/e496ca810f43513dd5c9d397dd1c0ada22cdf8e7))
* define v2 local-first skillops direction ([5480c37](https://github.com/ceasarXuu/OrnnSkills/commit/5480c37f3d07713f59a93b9b7610bbad5ab8dbe1))
* **frontend:** require shadcn-first v2 migration ([725848e](https://github.com/ceasarXuu/OrnnSkills/commit/725848e0b24a5e8892325b5a4a38ff31c0548ec4))
* **governance:** add task 11 — split oversized source files (>500 lines) ([10f67fa](https://github.com/ceasarXuu/OrnnSkills/commit/10f67fa4069b16beec0c5a741f2e738b88bb88dc))
* **governance:** mark task 11 (file-size red-line) as DONE ([af025cf](https://github.com/ceasarXuu/OrnnSkills/commit/af025cff3074e68beaeb37dd269b82131d72ebcd))
* make dashboard the v2 primary surface ([977160f](https://github.com/ceasarXuu/OrnnSkills/commit/977160f6a1d980ee75e86c5f4e0e7d783fd6f4c0))
* **plan:** detail skill domain rollout and validation ([e80cba0](https://github.com/ceasarXuu/OrnnSkills/commit/e80cba044bddee06ab340dd72019319df6b646f1))
* **plan:** rename skill domain refactor doc ([9c01741](https://github.com/ceasarXuu/OrnnSkills/commit/9c01741515d13b131441bb6d079114ceb969c042))
* **product:** define skill domain model and views ([ace6ae7](https://github.com/ceasarXuu/OrnnSkills/commit/ace6ae75a4b78c9aa810ecd3371a5513a0ecc09e))
* **progress:** record dashboard runtime sync gotcha ([f5bd2f9](https://github.com/ceasarXuu/OrnnSkills/commit/f5bd2f9059db8fbed199e4895ae6bbc28669e367))
* update governance plan progress tracker ([df1cd26](https://github.com/ceasarXuu/OrnnSkills/commit/df1cd26ec0c688f1a65a3bb50119dc4558e18537))


### ♻️ Code Refactoring

* align project rail shell with skills list ([4ec7cec](https://github.com/ceasarXuu/OrnnSkills/commit/4ec7ceca51c11ae2969f37ac44aa948d3f44c82f))
* align v3 config with the v1 workspace contract ([9b78376](https://github.com/ceasarXuu/OrnnSkills/commit/9b78376ca9429901cead2011f9754f955b5369a0))
* align v3 routes with the v1 dashboard shell ([ae06847](https://github.com/ceasarXuu/OrnnSkills/commit/ae06847023e005437564eaa64d5def87e480326a))
* **cli:** split completion.ts (547→152) extract per-shell generators ([79b5c89](https://github.com/ceasarXuu/OrnnSkills/commit/79b5c89946d3ffb383b6f2df6e68712c7dfb8c5e))
* **cli:** split daemon.ts (470→32) into per-subcommand modules ([82f4fce](https://github.com/ceasarXuu/OrnnSkills/commit/82f4fce36fd9485b8375de3219087b0d5f5d03b4))
* **cli:** split freeze.ts (461→8) into per-command + batch modules ([67d41df](https://github.com/ceasarXuu/OrnnSkills/commit/67d41df1d9d1aebb98fdf995894f6bf18bc0c8ce))
* complete dashboard ui facade split ([a723540](https://github.com/ceasarXuu/OrnnSkills/commit/a723540e5a19dbcc9fa98f6ac474274124896381))
* **config:** split dashboard-config.ts (510→460) extract types ([1105705](https://github.com/ceasarXuu/OrnnSkills/commit/11057055de136438edad5b4d092c31d4221c6fdc))
* **core:** split daemon analyzer and validator helpers ([a02a70f](https://github.com/ceasarXuu/OrnnSkills/commit/a02a70fe2b7d62e54c52ffab77fcd99ee121ba35))
* **dashboard:** align skill library sidebar with project nav ([0e155ed](https://github.com/ceasarXuu/OrnnSkills/commit/0e155eddf3bff197a48c313f5ca54b835efd7dc3))
* **dashboard:** hide header runtime metadata ([4b52ba3](https://github.com/ceasarXuu/OrnnSkills/commit/4b52ba328691b7b32e657956685078540bea8f6a))
* **dashboard:** integrate skill sidebar into split nav ([1468dd7](https://github.com/ceasarXuu/OrnnSkills/commit/1468dd7fcf91ce937cb4fd9aaae5a01588cf42f1))
* **dashboard:** promote project tab to top level ([ed66348](https://github.com/ceasarXuu/OrnnSkills/commit/ed6634869e660f677692aa4ecc9038ad3ddfd0a3))
* **dashboard:** remove redundant page hero blocks ([047d078](https://github.com/ceasarXuu/OrnnSkills/commit/047d078359517c0a93bcb8a5eaac7781d51db481))
* **dashboard:** split i18n.ts (1240→421) into i18n-en.ts/i18n-zh.ts ([b981474](https://github.com/ceasarXuu/OrnnSkills/commit/b9814743f174f8fb0143ca7b3b641e041a09f2ed))
* **dashboard:** split server.ts (593→462) extract http-utils + provider-health ([d1fbf0b](https://github.com/ceasarXuu/OrnnSkills/commit/d1fbf0b2ffd54b3676d0d62c3f9e02bdab749564))
* embed version controls in skill content ([023ed43](https://github.com/ceasarXuu/OrnnSkills/commit/023ed43fa05fc82c7a6134fa12047a9c0dbbe5f9))
* extract config env file ([7a86256](https://github.com/ceasarXuu/OrnnSkills/commit/7a86256b68c2a789ba865965eab3b3284f8bb088))
* extract config prompt overrides ([6b2877b](https://github.com/ceasarXuu/OrnnSkills/commit/6b2877b1626f4f32f105567cc9230af4d958beaf))
* extract dashboard activity business source ([ecc6621](https://github.com/ceasarXuu/OrnnSkills/commit/ecc6621ca2703c7b964940d5313f6485d1ebb979))
* extract dashboard activity detail source ([acb1690](https://github.com/ceasarXuu/OrnnSkills/commit/acb1690aac23f7817cc4aee3cd17c0e0b58e8b2e))
* extract dashboard activity listing source ([407cb8c](https://github.com/ceasarXuu/OrnnSkills/commit/407cb8cc0f10f033926b2f061af209dd4d4463fe))
* extract dashboard agent usage reader ([bdf8315](https://github.com/ceasarXuu/OrnnSkills/commit/bdf831551704a1ead0bc81cf05888b45cf5cc102))
* extract dashboard app shell ([a1fb3f9](https://github.com/ceasarXuu/OrnnSkills/commit/a1fb3f979bf3ed7eb46aea5110aafac13b256562))
* extract dashboard config module ([1bb5ecc](https://github.com/ceasarXuu/OrnnSkills/commit/1bb5eccbc89cb55e16588af321b8bdc5298b183e))
* extract dashboard config panel ([ca2dfcc](https://github.com/ceasarXuu/OrnnSkills/commit/ca2dfcc150b886c8abfa0e956db4cae5c576a2b9))
* extract dashboard cost panel ([358d42c](https://github.com/ceasarXuu/OrnnSkills/commit/358d42c57b7333a69547da85c78d7b1a7372594c))
* extract dashboard daemon status reader ([8d679cf](https://github.com/ceasarXuu/OrnnSkills/commit/8d679cf11c2128a1cb3396a71c81ab5af36b15ac))
* extract dashboard decision events reader ([6ed6639](https://github.com/ceasarXuu/OrnnSkills/commit/6ed66391962d5549bce5ac19a03d62721816114c))
* extract dashboard global config routes ([039c4f1](https://github.com/ceasarXuu/OrnnSkills/commit/039c4f1af5953018697939658c9f8f6a7fc452fe))
* extract dashboard logs panel ([805cf94](https://github.com/ceasarXuu/OrnnSkills/commit/805cf94e6a15ecae52f13becb41e03e3dbe843b0))
* extract dashboard metric rows render ([ff2757c](https://github.com/ceasarXuu/OrnnSkills/commit/ff2757ce457c1ca11a834de45b4565a45367d5b7))
* extract dashboard overview panel ([3fa9052](https://github.com/ceasarXuu/OrnnSkills/commit/3fa9052281dbd5c64ab9c980ccb69a03e25b4258))
* extract dashboard project config routes ([9f77d43](https://github.com/ceasarXuu/OrnnSkills/commit/9f77d431b6f8d25d84cc21b92138cb73fdef4413))
* extract dashboard project onboarding service ([5b1819f](https://github.com/ceasarXuu/OrnnSkills/commit/5b1819f9a6c63031a79ab957049511f860fe5b61))
* extract dashboard project read routes ([f675d40](https://github.com/ceasarXuu/OrnnSkills/commit/f675d4089366e9d6da0964c98622f3f05c9ac227))
* extract dashboard project skill routes ([677a845](https://github.com/ceasarXuu/OrnnSkills/commit/677a8458f84efdfe46c3e1d6c731c668497c8e13))
* extract dashboard project version routes ([ad079e0](https://github.com/ceasarXuu/OrnnSkills/commit/ad079e023cb245de1b517088a79543403cec0d4d))
* extract dashboard render sources ([6e6641d](https://github.com/ceasarXuu/OrnnSkills/commit/6e6641d629cf94590a4a17cad3aff0bb41e33d47))
* extract dashboard skill card render ([31a2dc4](https://github.com/ceasarXuu/OrnnSkills/commit/31a2dc46fdf8bc0247c2af485f6f7755a50d240d))
* extract dashboard skill version service ([af465e9](https://github.com/ceasarXuu/OrnnSkills/commit/af465e90d1acf7821c5793c961072afeaefbb3bc))
* extract dashboard skills activity panels ([58df219](https://github.com/ceasarXuu/OrnnSkills/commit/58df219311d8a8ce902c3f39980a5aa136c8ce20))
* extract dashboard skills reader ([f70364c](https://github.com/ceasarXuu/OrnnSkills/commit/f70364c7e3ea5535a8431d5bb760175af6589c0a))
* extract dashboard sse hub ([6b97ea0](https://github.com/ceasarXuu/OrnnSkills/commit/6b97ea096f77405c49169314235b0bfda4b0ddc8))
* extract dashboard state badge render ([41f9b7f](https://github.com/ceasarXuu/OrnnSkills/commit/41f9b7fff43199a63a9c896d9414a9aeefae77b5))
* extract dashboard styles source ([0befad1](https://github.com/ceasarXuu/OrnnSkills/commit/0befad1007b8d79053e6b473dfa8af8c1b4a90ff))
* extract dashboard trace bars render ([8cec034](https://github.com/ceasarXuu/OrnnSkills/commit/8cec034630790c2bc8e21b9d67145470e2bfc90b))
* extract dashboard trace reader ([e01d9dd](https://github.com/ceasarXuu/OrnnSkills/commit/e01d9dd8021125b488f7082e8215e0d9fb192216))
* extract dashboard ui state ([4de6ece](https://github.com/ceasarXuu/OrnnSkills/commit/4de6ece095bb9f1cd479c9686d16407efead4255))
* extract data tables from error-helper.ts (472→175) and i18n.tsx (427→80) ([2a061a5](https://github.com/ceasarXuu/OrnnSkills/commit/2a061a5f95f0fe1c5cb68f2694452ef74f1e23cb))
* extract provider connectivity module ([d52f871](https://github.com/ceasarXuu/OrnnSkills/commit/d52f871159f4cf5c5c5353e1a707f4646720fcf5))
* extract sqlite db adapter ([64e6f57](https://github.com/ceasarXuu/OrnnSkills/commit/64e6f574135ad614883a0bdf2bc6a1d35520e6d5))
* fix undefined-safe array indexing (prep for noUncheckedIndexedAccess) ([b881bb3](https://github.com/ceasarXuu/OrnnSkills/commit/b881bb323a045a7f45e3cc44394edf04324985dd))
* **frontend-v3:** extract skill-library cache module (499→483) ([6269ceb](https://github.com/ceasarXuu/OrnnSkills/commit/6269ceb2036753191e49ce2baab8f33a0871681a))
* **frontend-v3:** split use-dashboard-v3-config.ts (501→475) extract cache module ([bdfc7f2](https://github.com/ceasarXuu/OrnnSkills/commit/bdfc7f23711443c8ccc42f726da98bc93db0cb90))
* **frontend:** make v3 skills view workbench-first ([a9021af](https://github.com/ceasarXuu/OrnnSkills/commit/a9021af04a3e8739e952ccc1fd5bef66e67860a4))
* improve dashboard v3 storybook granularity ([705cfff](https://github.com/ceasarXuu/OrnnSkills/commit/705cfffa381cfd6119daf2154394c60c37a675f5))
* **llm:** split litellm-client.ts (561→467) extract types + extract helpers ([d8ee8ba](https://github.com/ceasarXuu/OrnnSkills/commit/d8ee8ba3a76d37525999e93ad6467bd9196416c5))
* merge cost into project workspace ([310c8c5](https://github.com/ceasarXuu/OrnnSkills/commit/310c8c5b185c716043f4517070060c3479391515))
* merge skill detail content frame ([c29e789](https://github.com/ceasarXuu/OrnnSkills/commit/c29e78946e685967b75f1ab236dbdfbdf0efd19f))
* move skills project scope control into detail header ([f305f75](https://github.com/ceasarXuu/OrnnSkills/commit/f305f75caf258c394a44c83ed560ae93d12bcb1f))
* **observer:** split claude-observer.ts (599→402) into types/preprocess ([734f972](https://github.com/ceasarXuu/OrnnSkills/commit/734f972f64a72e353faa9b7bd4ee3a4062813d3a))
* remove dead llm chains ([80df611](https://github.com/ceasarXuu/OrnnSkills/commit/80df611877edbf20189c8544cb2f307728151c8b))
* remove non-v1 project activity chrome from v3 ([1234801](https://github.com/ceasarXuu/OrnnSkills/commit/1234801f2ec3236c2d8d9a72ee0158f83db353d0))
* remove non-v1 project chrome from v3 ([c8c6624](https://github.com/ceasarXuu/OrnnSkills/commit/c8c6624a43e7662e35e8bcc19dca3bb6507513fb))
* remove non-v1 v3 route aliases ([4a29eae](https://github.com/ceasarXuu/OrnnSkills/commit/4a29eae0ecdb6b7ecccdd11c46b731db2f7f1488))
* restore v3 skill and project contracts ([fdd6699](https://github.com/ceasarXuu/OrnnSkills/commit/fdd669940b10709ccfb218c9730d664447edb006))
* retire v3 asset and build surface ([957d132](https://github.com/ceasarXuu/OrnnSkills/commit/957d132d70dcceb52a4de3a73ae44198442767af))
* route dashboard project management ([10c801b](https://github.com/ceasarXuu/OrnnSkills/commit/10c801b2b057c2f30a5388840381b346a3a948a2))
* **shadow-registry:** split index.ts (650→497) into types/serialization/stats ([8840b5c](https://github.com/ceasarXuu/OrnnSkills/commit/8840b5cab2dd66a85bd71c6a524970bd1e3b88b6))
* simplify skill detail instance selection ([42be206](https://github.com/ceasarXuu/OrnnSkills/commit/42be20620d7b6fffc85bb4045aceecb525da5ac4))
* simplify v3 workspace shells ([09b86f3](https://github.com/ceasarXuu/OrnnSkills/commit/09b86f3394983aca860bd76abfdd58f704a421f0))
* split codex observer components ([ce322ae](https://github.com/ceasarXuu/OrnnSkills/commit/ce322ae20f8be6300f5b9e3db7db3d8b41563403))
* split daemon helpers and harden sqlite saves ([97ab65a](https://github.com/ceasarXuu/OrnnSkills/commit/97ab65afcc3920a16dbd7c521c39ec2c62e804b9))
* split daemon runtime services ([8ef2837](https://github.com/ceasarXuu/OrnnSkills/commit/8ef2837c63787f6cd7fee9f8d84995bf17b3d9ff))
* split journal persistence modules ([834de5c](https://github.com/ceasarXuu/OrnnSkills/commit/834de5c3ee7b3f2374bc45203cecbf6c0f0c033a))
* split shadow manager services ([2ab0eaf](https://github.com/ceasarXuu/OrnnSkills/commit/2ab0eaf63a487b06cd0d0da7670307ca30c49363))
* split sqlite storage repositories ([5069613](https://github.com/ceasarXuu/OrnnSkills/commit/506961303b453639f3af2bcacabb8ee0b580acf2))
* standardize dashboard v3 storybook stories ([5db06ca](https://github.com/ceasarXuu/OrnnSkills/commit/5db06caeb35106901f99835bdc4dbdb9bb6c062f))
* **task-episode:** extract types module (492→415) ([c2408f9](https://github.com/ceasarXuu/OrnnSkills/commit/c2408f91d53cb918a7222b79bd980c1969e80f3f))
* **trace-manager:** extract pure helpers (492→396) ([02ee865](https://github.com/ceasarXuu/OrnnSkills/commit/02ee865232fff32dbcc6de6b6eaac98976e6731c))
* **trace-skill-mapper:** extract inference helpers (492→348) ([6e70fbd](https://github.com/ceasarXuu/OrnnSkills/commit/6e70fbd88de8da93a1281800b2fbd09a7c5e995c))


### 🐛 Bug Fixes

* align config choices with shadcn controls ([ebd44a6](https://github.com/ceasarXuu/OrnnSkills/commit/ebd44a68e0e76019ef58511ce00323230a9207bd))
* align locked skills layout rails ([b22ec12](https://github.com/ceasarXuu/OrnnSkills/commit/b22ec1256b69bca57ec38a40b13901aaa021b128))
* align project skills filters ([b58938d](https://github.com/ceasarXuu/OrnnSkills/commit/b58938de13f25354ca83838bf11e5ca618bc4640))
* avoid dashboard snapshot thrash in skills view ([60c37e9](https://github.com/ceasarXuu/OrnnSkills/commit/60c37e90ee527bb5c73f866c00e1464f441e1531))
* bound long-running dashboard episode state ([729fcff](https://github.com/ceasarXuu/OrnnSkills/commit/729fcffc936b763713feb9021e1094ebc3caaba9))
* bypass stale browser etag cache ([1c3dc57](https://github.com/ceasarXuu/OrnnSkills/commit/1c3dc57e71780984582e9c93eeb1d3ed47b1f752))
* cache dashboard config workspace state ([bcd05dc](https://github.com/ceasarXuu/OrnnSkills/commit/bcd05dc75f9ae7cc50644ca41dce544641254ee7))
* cache dashboard skills workspace state ([8da23d2](https://github.com/ceasarXuu/OrnnSkills/commit/8da23d2d06b73a9d05ba3eda483e6c2197849ca6))
* **cli:** resolve daemon background entry path ([f14c611](https://github.com/ceasarXuu/OrnnSkills/commit/f14c6111c70a18ee4daf03ca92d64d8a378aebb5))
* compact dashboard v3 cost summary ([2e56a5f](https://github.com/ceasarXuu/OrnnSkills/commit/2e56a5f2927289798097a10b284a3bc5985975f6))
* **core:** reduce observer and explainer warning noise ([9606f68](https://github.com/ceasarXuu/OrnnSkills/commit/9606f68129d4f6fe8e9a67935a324b57faf959b4))
* **dashboard:** align skill sidebar with project nav ([285d2b8](https://github.com/ceasarXuu/OrnnSkills/commit/285d2b83efe055b2a12689e1d75100bc08384158))
* **dashboard:** decouple sse from snapshots ([505c11f](https://github.com/ceasarXuu/OrnnSkills/commit/505c11f7724f0a3d5455b52680653f47cf128909))
* **dashboard:** fix indentation in server.ts and deduplicate normalizeLanguage ([28c57f1](https://github.com/ceasarXuu/OrnnSkills/commit/28c57f1747d8769e4660bf50aace21f87f48f88a))
* **dashboard:** remove market intro block ([e30e5e7](https://github.com/ceasarXuu/OrnnSkills/commit/e30e5e7464364b6edc64814a9970cb8042a42324))
* **dashboard:** serve root on head probes ([26654c4](https://github.com/ceasarXuu/OrnnSkills/commit/26654c49e5c0160d76cc65cab664b5a6fef03ebf))
* **dashboard:** show built-in prompt defaults ([cd191aa](https://github.com/ceasarXuu/OrnnSkills/commit/cd191aac6664bec601e832be399e55bf58ff0fab))
* **dashboard:** shrink sse snapshot payloads ([df090da](https://github.com/ceasarXuu/OrnnSkills/commit/df090da89d2ac953817308d8dba9dc3f196e88ef))
* **dashboard:** simplify market cards ([7b2db21](https://github.com/ceasarXuu/OrnnSkills/commit/7b2db2163104fe02d7d91e24d7988b579a8cf26f))
* **dashboard:** unblock project bootstrap ([d97c9a9](https://github.com/ceasarXuu/OrnnSkills/commit/d97c9a97db09f68bf59561a6857ca8757750924b))
* filter skill library instances by host ([b5da780](https://github.com/ceasarXuu/OrnnSkills/commit/b5da7805022d5f16427d6c9cfb029603753df4c4))
* **frontend-v3:** close setSkillLibraryCache call + drop unused i18n-cost import ([f23c393](https://github.com/ceasarXuu/OrnnSkills/commit/f23c393ef6975dedb29ea9e5415e9ac1d4dbe636))
* **frontend:** align v2 workbench with shadcn preset ([9e58a4d](https://github.com/ceasarXuu/OrnnSkills/commit/9e58a4db5f7d7324dea99bb71de64d573e7454a4))
* keep skills rail sticky in locked layout ([88a2351](https://github.com/ceasarXuu/OrnnSkills/commit/88a2351f5606e4f59c2e9c0f5ea152e7f92b9d85))
* **llm:** align LiteLLMResponse type with validated guard shape ([c04ca08](https://github.com/ceasarXuu/OrnnSkills/commit/c04ca084f470295a6f328e7d0ee8dc01a65d23b1))
* **llm:** retry truncated structured deepseek responses ([4d1e237](https://github.com/ceasarXuu/OrnnSkills/commit/4d1e237961501ced8780db5e9f427ae1e8719e62))
* **llm:** validate LiteLLM response shape at HTTP boundary ([f4ed198](https://github.com/ceasarXuu/OrnnSkills/commit/f4ed198ebacc581079d62f59b0061aa8a84ce417))
* lock skills workspace layout tracks ([7144f14](https://github.com/ceasarXuu/OrnnSkills/commit/7144f14d256258a98cdd46fe4898879a308c183c))
* **logging:** add logging to 7 critical empty catch blocks on hot paths ([e4b2dae](https://github.com/ceasarXuu/OrnnSkills/commit/e4b2daed88bec441c7310644031084c9a54a5505))
* **logs:** isolate test logging from runtime status ([0fb1ade](https://github.com/ceasarXuu/OrnnSkills/commit/0fb1ade7de6813220117b92e6f9975f9dc60c497))
* **observability:** add structured logging to project onboarding lifecycle ([a8b41f2](https://github.com/ceasarXuu/OrnnSkills/commit/a8b41f2ff69d7415ee1cee2574629ab96a89fd7a))
* onboard dashboard projects into monitoring ([f0e8f80](https://github.com/ceasarXuu/OrnnSkills/commit/f0e8f804c66f60a65351452dae943fd19bdec88d))
* preserve inline skill history during library refresh ([283c4f3](https://github.com/ceasarXuu/OrnnSkills/commit/283c4f355d168fa0478d34689d197b5f3d7dcf36))
* remove dashboard header refresh action ([e5411e3](https://github.com/ceasarXuu/OrnnSkills/commit/e5411e33bb8d87bf23c04e866b58fafe42726775))
* remove hot-path trace rereads ([58e7176](https://github.com/ceasarXuu/OrnnSkills/commit/58e7176c894d34d77326776d1815f000680f56b7))
* remove skill library runtime filter toolbar ([162045a](https://github.com/ceasarXuu/OrnnSkills/commit/162045a3d46fd05ff660651a5c8353d5153f76ef))
* remove unused skill usage metrics ([0d2684d](https://github.com/ceasarXuu/OrnnSkills/commit/0d2684d3f1e8ff1354226f053a838ae2733b1be7))
* restore ci validation chain ([e24867f](https://github.com/ceasarXuu/OrnnSkills/commit/e24867fb408c2307abeb71a4c35e05e6e4401ae0))
* restore inline skill detail after live refresh ([579d53d](https://github.com/ceasarXuu/OrnnSkills/commit/579d53dc9a2bca2c55b4a48102e3affd54dece8b))
* scope project skills by host ([b922ece](https://github.com/ceasarXuu/OrnnSkills/commit/b922ece45c5dcc5aec7ca9ecfa0ce479cbc128a7))
* **security:** add path validation to project onboarding endpoint ([8f0347f](https://github.com/ceasarXuu/OrnnSkills/commit/8f0347f9defff5e456fad91ec774fa1032aa8816))
* **security:** replace exec with spawn in openBrowser to prevent command injection ([5f1dff9](https://github.com/ceasarXuu/OrnnSkills/commit/5f1dff9334d164299745a0a3ad1ea7d6843e6436))
* show family apply preview in dialog ([fafaba6](https://github.com/ceasarXuu/OrnnSkills/commit/fafaba68e08927d6c01ab61a058009980ca76bec))
* silence noop trace cleanup logs ([48dc082](https://github.com/ceasarXuu/OrnnSkills/commit/48dc08257649ac1d7e4584af8e1c045b1a2f4467))
* simplify v3 dashboard chrome ([c8e2044](https://github.com/ceasarXuu/OrnnSkills/commit/c8e20446777294d21603b6f74a257ed893e305d9))
* speed up dashboard v3 skill content loading ([fccf748](https://github.com/ceasarXuu/OrnnSkills/commit/fccf748d8fc7909ef922b61ed5038aa0e7229c08))
* stop routing traces for unregistered runtimes ([ae23e50](https://github.com/ceasarXuu/OrnnSkills/commit/ae23e5007119a4365f6eeea91dde7959db6d9ab6))
* trim initial dashboard sse payload ([dfca6a1](https://github.com/ceasarXuu/OrnnSkills/commit/dfca6a11bf051dca64d6171d0bd997ea690488d5))
* use native picker for dashboard project add ([3591124](https://github.com/ceasarXuu/OrnnSkills/commit/3591124937bfeafbf73b7e19df98fbb9d3a82847))


### ✨ Features

* add dashboard bootstrap cache ([2acf810](https://github.com/ceasarXuu/OrnnSkills/commit/2acf810faed4afda2e66c3d1ca522292e33937ff))
* add dashboard v3 storybook ([cff2cac](https://github.com/ceasarXuu/OrnnSkills/commit/cff2cac88548eb78840ec9f9964820cd2172a008))
* add project prompt overrides ([377b16f](https://github.com/ceasarXuu/OrnnSkills/commit/377b16fd3d11f156d987b03a899829517c032807))
* add project rail search ([b19e0dc](https://github.com/ceasarXuu/OrnnSkills/commit/b19e0dcd500db6ad60536ada0ee4730e94de314b))
* add remotion promo animation ([460def4](https://github.com/ceasarXuu/OrnnSkills/commit/460def4f76199b30b402eb7bb89ba8265fbfa683))
* add sticky project rail picker ([9f023f3](https://github.com/ceasarXuu/OrnnSkills/commit/9f023f3088d8145138038f999244dea9f28ea2ca))
* compact skill version history diff ([4cb9d30](https://github.com/ceasarXuu/OrnnSkills/commit/4cb9d30bf617ed64922d485218a1e4bb709f051f))
* **dashboard:** add lightweight market tab ([9d5fadf](https://github.com/ceasarXuu/OrnnSkills/commit/9d5fadfbed86cb04b078d4b4244e80163f47d2e1))
* **dashboard:** add marketplace skill review ([6941549](https://github.com/ceasarXuu/OrnnSkills/commit/69415497e6f2959afd3f8b5b85ab10c057575bc4))
* **dashboard:** add per-project monitoring pause controls ([6661838](https://github.com/ceasarXuu/OrnnSkills/commit/6661838330ae11b223c1b972e6492e6d8b8d9b4b))
* **dashboard:** center primary tabs in header ([82cfb68](https://github.com/ceasarXuu/OrnnSkills/commit/82cfb68a0bf295e7e3fc9b02ef44969a9c1edd2f))
* **dashboard:** inline skill library details in workspace ([e7556bc](https://github.com/ceasarXuu/OrnnSkills/commit/e7556bc2f9620b4e91d9da64a4ef6dcdacd5e533))
* **dashboard:** persist grouped skill host selection ([5ae1e17](https://github.com/ceasarXuu/OrnnSkills/commit/5ae1e171f65a8d1f2733cfe60c2932a35cd247b3))
* **dashboard:** promote three primary workspace tabs ([085de9b](https://github.com/ceasarXuu/OrnnSkills/commit/085de9ba9eae82c5000458f5c228ec55653253ac))
* **dashboard:** scaffold isolated v2 frontend preview ([e54e2a9](https://github.com/ceasarXuu/OrnnSkills/commit/e54e2a9f9ff27c6b2f897c2ddf6bdb3e605a7894))
* **dashboard:** simplify workspace page headers ([0af2fd9](https://github.com/ceasarXuu/OrnnSkills/commit/0af2fd97ac12b555494438ad20b8ae33fd827231))
* **dashboard:** split global home from project workspace ([b0e4773](https://github.com/ceasarXuu/OrnnSkills/commit/b0e4773ec1104bce5f267536ef45478b1d3e2336))
* **dashboard:** support muting skill versions ([59dc458](https://github.com/ceasarXuu/OrnnSkills/commit/59dc458021da712a8ec880e53f1ffd53cdd1b9db))
* **dashboard:** toggle api key visibility in config ([0c19c4e](https://github.com/ceasarXuu/OrnnSkills/commit/0c19c4e0f0348c075339623c71817ca4b40e0add))
* **frontend:** add clean-slate dashboard v3 workspace ([89bed13](https://github.com/ceasarXuu/OrnnSkills/commit/89bed132a2c2bd7b7437555ce38de41914301187))
* **frontend:** route v2 workspace through shadcn panels ([10232c2](https://github.com/ceasarXuu/OrnnSkills/commit/10232c2233682d32a44a77435434ff20594dfd74))
* harden dashboard cache revalidation ([32b9a22](https://github.com/ceasarXuu/OrnnSkills/commit/32b9a2204d504c312b769426763bbbae51afc5fa))
* implement global dashboard prompt source selection ([123e75b](https://github.com/ceasarXuu/OrnnSkills/commit/123e75b2781cddd9281d2efb230afab14fb70fef))
* make dashboard v3 the default entry ([b3eaf22](https://github.com/ceasarXuu/OrnnSkills/commit/b3eaf2235007b20a2fd3505adcf5171f7afd5d09))
* rebuild v3 skills workspace shell ([5d69b8c](https://github.com/ceasarXuu/OrnnSkills/commit/5d69b8c121f2c897bbc9c8a9966bc7d035f97f04))
* restore dashboard v3 cost tab ([8d3a6a3](https://github.com/ceasarXuu/OrnnSkills/commit/8d3a6a3328fd1cf389c8574a283065f2405a6700))
* restore dashboard v3 language controls ([4aa2a2a](https://github.com/ceasarXuu/OrnnSkills/commit/4aa2a2abe3d97fbccb97e32e8ad39ec2789e6e8a))
* restore v3 config workspace ([e29581b](https://github.com/ceasarXuu/OrnnSkills/commit/e29581b9da1931727c3a77300c6db3fcb1385c8d))
* **skill-domain:** add family and instance projections ([8b22634](https://github.com/ceasarXuu/OrnnSkills/commit/8b22634d480432e230abbd9dcb10ffb002ab6230))
* split config panel subtabs ([40ad922](https://github.com/ceasarXuu/OrnnSkills/commit/40ad922aef75361ae84f7df7b594b97dcd6cfd77))
* unify skill library sidebar design ([b184540](https://github.com/ceasarXuu/OrnnSkills/commit/b1845408fa99ca8c83c83462211562e4c023af46))

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
