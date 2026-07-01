# [🌍 Prehistoric Civilization Simulation](https://Realmit.github.io/population-simulation/) <-- Click me!
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=flat&logo=vite&logoColor=FFD62E)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![License](https://img.shields.io/github/license/Realmit/population-simulation?t=1)
![Repo Size](https://img.shields.io/github/repo-size/Realmit/population-simulation?t=1)
![Last Commit](https://img.shields.io/github/last-commit/Realmit/population-simulation?t=1)
 
[**English**](README.md) | [**Русский**](READMERU.md)

---
A browser-based simulation of early human civilization development. Your agents form communities, gather resources, master crafting technologies, and struggle for survival in a world featuring dynamic water bodies.

<h1 align="center">
  Now modular!
</h1>
<h3>
Create your own modules with existing instructions and easy-to-use template! Resources, terrain, human roles and much more! Anything can be modded in as a module!
</h3>
Existing example modules: mountain generation, food system, farmers (sub-addon for food system addon)

[Module readme](https://github.com/Realmit/population-simulation/blob/main/MODULES.md)
[Module quickstart](https://github.com/Realmit/population-simulation/blob/main/MODULES_QUICKSTART.md)
<h1 align="center">
  <img width="1468" height="974" alt="image" src="https://github.com/user-attachments/assets/7dc34208-40c7-41f4-86e5-3088901513d4" />
</h1>

## 🚀 Key Features

* **🏘️ Dynamic Communities:** Humans unite into villages (4-6 people), elect leaders, and manage development[cite: 1].
* **💧 Intelligent Water System:** Lakes and rivers create natural barriers that humans overcome using automatically generated bridges[cite: 1].
* **🪓 Tool Progression:** Improve labor efficiency from wooden to copper tools[cite: 1].
* **🌱 Ecosystem:** Female residents actively restore the forest by planting trees to ensure renewable resources[cite: 1].
* **🧬 Genetics:** Attributes and royal titles are passed down through generations[cite: 1].

---

## 🛠️ Crafting System

<details>
<summary><b>View Tool Statistics Table</b></summary>

| Tool Tier | Gathering Bonus | Crafting Cost |
| :--- | :--- | :--- |
| **Wooden** | +40% Speed | 4 Wood |
| **Stone** | +64% Wood, +40% Stone | 8 Wood + 4 Stone |
| **Copper** | +78% Wood, +64% Stone, +40% Copper | 16 Wood + 8 Copper |

</details>

---

## 📊 Character Attributes

<details>
<summary><b>View Character Attributes Table</b></summary>

| Attribute | Role |
| :--- | :--- |
| **Health** | Survivability and load resistance[cite: 1] |
| **Strength** | Speed and extraction efficiency[cite: 1] |
| **Intelligence** | Speed of performing complex tasks[cite: 1] |
| **Charisma** | Success in leadership and family creation[cite: 1] |

</details>

---

## 🎮 Controls

<details>
<summary><b>View Controls Table</b></summary>

| Action | Control |
| :--- | :--- |
| **Interaction** | Left Click (on human or resource)[cite: 1] |
| **Navigation** | Drag (Pan) / Mouse Wheel (Zoom)[cite: 1] |
| **Simulation Control** | "Restart", "Spawn", "Reset Camera" buttons[cite: 1] |
| **Personalization** | ✎ icons for renaming[cite: 1] |

</details>

---

## 🏗️ Population Limits

<details>
<summary><b>View Population Limits Table</b></summary>

Population growth depends on your technical progress[cite: 1]:
* **Base:** 4 people[cite: 1]
* **Wooden Tools:** +1 per tool (max 5)[cite: 1]
* **Stone Tools:** +1 per tool (max 10)[cite: 1]
* **Copper Tools:** +1 per tool (unlimited)[cite: 1]

</details>

---

## 📂 Project Structure

```text
src/
├── simulation/
│   ├── Human.js           # Логика агентов (движение, задачи, мосты)
│   ├── Base.js            # Управление поселениями
│   ├── names.js           # Списки имён
│   └── settlementNames.js # Имена поселений
├── components/
│   └── SimulationCanvas.jsx # Основной рендерер и интерфейс
├── App.jsx
├── main.jsx
└── index.css
```

## ⚙️ Technologies

- React 18
- JavaScript (ES6)
- HTML5 Canvas для рендеринга
- Vite для сервера разработки

## 📝 License

MIT

Feel free to modify and expand this simulation! The core systems are designed to be extended with additional mechanics such as trade, conflicts, or technological advancements.
