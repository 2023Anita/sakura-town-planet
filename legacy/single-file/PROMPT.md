# Design brief / 设计提示词

This is the brief the project was built from. Paste it (or a modified version) into Codex /
Claude / any coding agent to regenerate or extend the scene. 可直接复制给 AI 编程助手复现或扩展。

---

**中文版**

用 Three.js 从零写一个**单 HTML 文件**的可自由漫游 3D 动漫樱花小镇星球：

1. **全程序化**：不使用任何外部模型、贴图或音频；招牌纹理、花瓣、窗户、角色表情全部用 Canvas 生成；普通笔记本流畅运行（实例化 + 静态合批），移动端自动降级。
2. **小星球**：小镇包裹在一颗可以绕一圈的小星球上，引力指向球心；铁路沿赤道环绕整颗星球。
3. **商店街**：多行日文招牌（スナック／やきとり／ラーメン／喫茶…）、竖排突出招牌、条纹遮阳篷、能看到店内纵深（货架、柜台、灯光）、人行道展示物（自动贩卖机、水果摊、自行车、立牌、盆栽）、楼上阳台晾衣服（随风摆动）、电线杆和电线、商店街拱门。
4. **夜景氛围**：红纸灯笼串、暖光在湿润路面上的倒影、蓝调阴影、路灯与窗户在夜里亮起。
5. **交通系统**：铁路道口（栏杆起落、红灯交替闪烁、警铃声）；通勤电车环线运行并在站台停靠，透明车窗可以看到粉色长椅和吊环；站台有黄色盲道、站名牌、长椅、自动贩卖机、时钟。
6. **樱花**：染井吉野式伞状树冠，几万张实例化花簇卡片，着色器做风吹摆动，持续飘落花瓣，树下有落花。
7. **动漫角色**：Canvas 绘制会眨眼的大眼睛脸，关节式行走动画，水手服／学兰／便装，双色赛璐珞着色 + 描边；行人会在道口等电车。
8. **场景多样性**：白日樱花大道、黄昏紫调商店街、夜巷灯笼横丁、电车车厢内部、夜景码头（灯塔光束、渔船、水面倒影）。
9. **交互**：第一人称 WASD 漫游 + 飞行、碰撞检测、日夜切换和时间流动、上下电车、数字键场景传送、移动端摇杆、Web Audio 合成环境音（风、鸟、虫鸣、海浪、警铃、电车）。
10. **美术风格**：三渲二卡通渲染、清晰轮廓线、温暖治愈的日式动画氛围。

---

**English**

Build, from scratch, a **single-HTML-file** Three.js scene: a freely explorable anime sakura town on a tiny planet.

1. **Fully procedural** — no external models, textures or audio. Signboards, petals, windows and character faces are drawn on `<canvas>`. Runs smoothly on an ordinary laptop (instancing + static batching) and degrades gracefully on mobile.
2. **Tiny planet** — the town wraps around a small sphere you can walk all the way round; gravity points to the centre; a railway loops the equator.
3. **Shopping street** — multi-line Japanese signs (スナック, やきとり, ラーメン, 喫茶…), protruding vertical signs, striped awnings, visible shop interiors, sidewalk displays (vending machines, fruit stands, bicycles, A-boards, plants), balconies with laundry swaying in the wind, utility poles and wires, entrance arches.
4. **Night mood** — strings of red paper lanterns, warm reflections on wet asphalt, blue shadows, street lamps and windows lighting up at night.
5. **Railway** — level crossing with lowering gates, alternating flashing lights and a bell; a commuter train that loops the planet and stops at the station, with transparent windows revealing pink bench seats and hand straps; a detailed platform.
6. **Sakura** — Somei-Yoshino umbrella canopies built from tens of thousands of instanced blossom cards, shader wind sway, continuously falling petals and petal carpets.
7. **Anime characters** — canvas-drawn blinking big-eyed faces, jointed walk cycles, sailor uniforms / gakuran / casual clothes, two-tone cel shading with outlines; pedestrians wait at the crossing.
8. **Scene variety** — daytime sakura avenue, purple dusk shopping street, lantern-lit night alley, train interior, night harbour with lighthouse beam, boats and reflections.
9. **Interaction** — first-person WASD walk + fly, collisions, day/night toggle and time flow, boarding the train, number-key teleports, mobile joystick, Web Audio ambience.
10. **Art direction** — toon / cel-shaded "三渲二" look, crisp outlines, warm and healing Japanese-anime atmosphere.
