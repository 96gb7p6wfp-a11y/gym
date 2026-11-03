# Setline 继续完善：公开用户反馈研究

检索日期：2026-11-03。范围：Hevy、Strong、Fitbod 的公开 Reddit 原帖、App Store 原始用户评价及厂商帮助文档。研究稿，不是代码审计结论，不涉及用户私人账号。

## 结论和证据边界

本次最值得 Setline 借鉴的方向是：减少训练中录入和切页、可靠保存与可恢复备份、自动呈现真实成果、清楚区分测量与估算、解释并允许拒绝建议、让定时器行为符合预期。**这是有目的地寻找抱怨的小样本，不是随机调查；不能据此断言这些问题普遍存在、比较故障率或评价哪款 App 整体更好。** 几篇原帖本身也包含满意用户和反例。2023–2025 年抱怨只能说明当时体验；当前厂商文档/更新记录可能已经解决问题。

日期校验：Reddit 对外页面经常只有相对时间。本稿日期用公开 `.json?raw_json=1&limit=1` 返回的首个帖子 `created` Unix 时间核实（UTC），评论日期另有注明。App Store 使用页面明确显示的评价日期。引用刻意只保留短摘。

## 可读的真实用户反馈来源

|编号|日期与来源|短引文（用户原话）|实际证据与限制|
|---|---|---|---|
|S1|2025-06-19，Hevy，[Lost workout thru watch](https://www.reddit.com/r/Hevy/comments/1lfhz24/lost_workout_thru_watch/)|“But it didn't save this time, gutted tbh”|用户称 Apple Watch 完成训练、刷新到手机后发现未保存，包含两项个人纪录；同帖另一个用户报告断连。Hevy 团队回复建议检查 unsaved workout，并要求进一步调查。不能证明所有同步流程不可靠。|
|S2|2025-05-09，Hevy，[Workout history not visible when creating new routines](https://www.reddit.com/r/Hevy/comments/1kijctg/workout_history_not_visible_when_creating_new/)|“I either have to guess or leave the weight at 0”|用户在建计划时无法参考上次重量，要到实际训练再填；另一位用户说希望编辑屏直接看到上次数字以节省点击。说明历史数据有了但出现的时机/位置仍影响体验。|
|S3|2023-10-10，Hevy，[First workout complete - one question](https://www.reddit.com/r/Hevy/comments/174k9tp/first_workout_complete_one_question/)|“I have to keep looking at the app”|用户期望平板支撑输入 40 秒后倒计时提醒，实际内联控件从 0 正计时且不会在 40 秒提醒；讨论中有人把训练计时与休息计时混淆。官方当前帮助确认这本来就是秒表，另有倒计时入口。属于设计/语义落差，不能简单称崩溃或故障。|
|S4|2025-06-08，Strong，澳大利亚 [App Store 评价 What have you done!!!](https://apps.apple.com/au/app/strong-workout-tracker-gym-log/id464254577?platform=watch)，用户 q@&36;|“if you go to change the reps and accidentally press too low”|页面明确日期 `08/06/2025`（澳大利亚日/月），用户已有近 300 次训练，抱怨更新后的组下计时器紧邻次数，误触后需重置、多次返回。只引用这 15 个英文词，整页非 Reddit 引文不超过 25 词。|
|S5|2025-01-09，Strong，[Feature request - add all graphs that have data](https://www.reddit.com/r/strongapp/comments/1hxachi/feature_request_add_all_graphs_that_have_data/)|“don't want to see a load of blank ones”|用户希望自动添加近期有数据的图，逐项添加很费时；开发者回复会研究相关图表/widget 需求。支持“自动有用的图”而非无选择地塞满图。|
|S6|2024-12-15，Strong，[Periodic Export?](https://www.reddit.com/r/strongapp/comments/1hf47k8/periodic_export/)|“schedule regular backups, whether daily or weekly”|用户想周期导出、自己做趋势图。原帖先编辑说通过 Health Connect 解决，后续评论 2024-12-31 又称缺训练细节；2025-03-21 另一个用户也询问 API/自动导出。只能证明备份/可移植/可视化需求，当前功能能否满足还应看官方，不能抹掉原帖自我修正。|
|S7|2025-07-08，Strong，[Feature ideas](https://www.reddit.com/r/strongapp/comments/1lv3xli/feature_ideas/)|“Weekly sets per muscle”|原帖希望每周肌群组数、e1RM 等；2025-07-09 评论有人自己用导出数据做进步工具。特别注意原帖作者后来发现 Pro 已有 e1RM 图，不能据此声称 Strong 没有该功能；更像发现性和所需汇总不足。|
|S8|2026-02-27，Fitbod，[Every time I open this app I have to spend a minute lowering the number of sets](https://www.reddit.com/r/fitbod/comments/1rg87e0/every_time_i_open_this_app_i_have_to_spend_a/)|“why's it jumping from doing 9 reps to 20?”|用户称更新建议经常增加组数和重量，每次需查看历史并手动调低，担心动作质量。只把痛感当作用户报告，不据此判断伤病或建立因果。|
|S9|2026-10-12，Fitbod，[Previously satisfied customer](https://www.reddit.com/r/fitbod/comments/1x47yx6/previously_satisfied_customer/)|“the next week, it's suggesting 22 reps at 65lbs”|用户报告由 35lb×10 次跳到 65lb×22，另有核心训练减少、热身占比过大等抱怨；同帖另一个多年用户明确说没有这些问题而且进步良好。**用户所猜的 AI/历史过多原因没有被证实，不能转述为事实。**|
|S10|2025-12-23，Strong，[FarCalligrapher1862 的单位切换评论](https://www.reddit.com/r/strongapp/comments/1pu80sb/comment/nvms58t/)|“switch between lbs/ kgs easily on screen”|公开 JSON 评论 `created_utc=1766533896`，为 2025-12-23 23:51:36 UTC。希望出差时单位直接切换，同一支讨论另一个用户支持。原帖同页还有人明确反对新增社交/AI；不能假定所有用户希望添加更多功能。|

## 官方说明对照（区别用户体验与当前功能）

1. Hevy 官方 [Previous Workout Values](https://help.hevyapp.com/hc/en-us/articles/36011896355479-How-to-Use-Previous-Workout-Values-to-Improve-Performance-in-Hevy) 说明训练中的 Previous 可按同一计划/任何计划显示，且**它仅控制 Previous 栏，不是计划的默认重量/次数**。这解释 S2 的场景差别，不能把“功能存在”当“全流程好用”。页面无明确发布日期，访问 2026-11-03。
2. Hevy 官方 [内联计时为什么正计时](https://help.hevyapp.com/hc/en-us/articles/35379662997783-The-duration-exercise-inline-timer-goes-up-and-not-down-why) 明确内联 Play 是秒表；需要倒计时要去顶部时钟，完成后再手动录入时长。支持 S3 是用户预期落差。页面无明确发布日期，访问 2026-11-03。
3. Strong 官方 [导出数据](https://help.strongapp.io/article/235-export-workout-data)，页面最后更新 2021-04-27，说明 CSV 导出，并说其导出文件不能直接导回 Strong。帮助页较老，不能当作 2026 实测；对 Setline 的启示是“导出文件”与“可验证恢复”须分别说明。
4. Strong 官方 [Exercise Detail](https://help.strongapp.io/article/237-about-exercise-detail)，最后更新 2021-02-08，列明每个动作的历史、Pro 图表与纪录。不要因 S7 的请求误说它没有图表。
5. Strong 当前 [App Store 版本记录](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) 的 6.2.7（2026-01-14）记录修复后台不倒计时/回前台重置；6.1.2（2025-07-16）记录大量历史时启动/浏览慢等修复；6.5.1（2026-10-08）已有休息计时 Live Activity。**这些是已发布修复，不能写成当前仍存在的缺点。** 对 Setline 更适合作为回归测试场景。
6. Fitbod 官方 [决定组/次数/重量](https://help.fitbod.me/hc/en-us/articles/43489869175063-How-does-Fitbod-decide-my-sets-reps-and-weight)，页面更新 2026-09-15，说明以训练史、RIR、近期表现推算、训练后可手动调整；会随训练变化。S8/S9 是用户遇到的建议落差，不能证明官方算法始终如此。
7. Fitbod 官方 [恢复估计](https://help.fitbod.me/hc/en-us/articles/43492170863895-How-does-Fitbod-know-my-muscles-are-still-recovering) 明确恢复百分比是模型而非生理测量，运动如果没有记录不会自动被看到，且允许手动更改。对排球运动员，不能只看力量训练去断言腿已完全恢复。

## 6 类反复出现的痛点 → Setline 可落地改进

“反复出现”仅指本次来源中有重复主题，不代表总体流行程度。下列有的是用户提出的功能需求，有的是当时缺陷，有的是设计预期落差。

|痛点|证据|Setline 建议|可验证结果|
|---|---|---|---|
|录入与找历史打断训练|S2、S4、S8|保留 V14 一键复用；显示上次训练日期、对应动作与上下文，训练前也可查；重量/次数/完成按钮触区分离，大按钮和数字键盘|单手可以查看来源、复用、改一次重量、完成一组；计时器不会与次数输入重叠；绝不自动把复用值标为已完成|
|计时器语义不清/控制易扰动|S3、S4；官方修复记录|明确“休息倒计时”与“动作计时”；继续用绝对结束时间，前台恢复重新算剩余；安静处理早已过期的计时器；调整按钮明确|锁屏/换标签/杀页重开显示正确剩余；恢复不会补响一串旧提醒；不承诺 iOS PWA 不能保证的后台声音|
|数据保存、周期备份与迁移信心不足|S1、S6|保留 V14 预览验证/恢复前安全副本；记录“上次成功备份”、是否有新记录未备份、当前设备本地保存状态；必要时轻提示导出|导出失败/取消不记成功；备份须包括计划/饮食/设置；更新无改写历史；不能把本地存储描述成云同步|
|有图却不易看到有意义的进步|S5、S6、S7|成果概览默认选已有真实数据：近 4/12 周训练次数/完成组、可比的最高工作组、体重趋势、配对测得的助跑优势；每张图给“起点→最近、变化、样本量、日期”|没有数据时给明确下一步而不是 0 成绩/空图；单点不画增长率；切时间范围/查看原始训练；图不靠颜色独占语义|
|自动建议不透明、改动计划造成额外工作|S8、S9；S10 同帖对 AI/社交的相反偏好|维持 V13.1 计划内容与启用状态；把建议和已执行记录分开；用可追溯原因解释加重/减量；改计划须用户主动应用；不新增未经授权自动教练|更新只改变 App 显示，不换训练计划；不把计划组数当完成；修改重量不反写旧历史；不把疼痛评分当诊断|
|器械/单位/数据口径与实际场景不匹配|S10、S2；Fitbod 官方设备设置/恢复模型|单位转换明确；机器与自由重量、双侧/单侧不可无条件混算；排球训练与体育课可算负荷背景，实际数过的/估计跳跃触地分开；成果趋势沿用相同测量协议|不因估计触地显示“实测总跳数”；不同单位在换算后比较；未知/未录入留空，不能补零；估算 e1RM 永远写明“估计”|

## 本轮最有价值、风险较低的实现范围

优先做一个“成果概览”：从现有历史派生、只读、不加数据迁移、不改 V13.1，自动展示有数据的趋势和来源，补齐跨周日期/空值/单点/可比动作的正确性。配套将“新版本可用”提示放在常见入口并保护进行中的训练，和一个简明备份状态入口。它们直接服务用户“打开 iPhone 就能练、看得到成果”的目标。

不要为成熟感堆叠社交、积分、AI、恢复精确百分比或虚构比赛提升。不要承诺一次审计“找尽所有缺点”。排球成果最好使用同协议测得的站立/助跑摸高、纵跳；力量/体重是并列指标，不等于比赛表现因果。训练方案的科学审核由独立方案审查完成，本稿只提供产品体验证据。
