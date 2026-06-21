# 🦷 Dental Day API

API REST para el Sistema de Control y Agenda de Pacientes de la Clínica Dental Day (El Rama, Nicaragua).

## 📋 Estado del proyecto
🚧 En desarrollo — Sprint 0 completado, iniciando Sprint 1 (Autenticación)

## 🛠️ Stack tecnológico
- **Runtime:** Node.js + Express.js
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT + RBAC
- **Arquitectura:** Monolito Modular con Clean Architecture

## 🚀 Instalación
*(Instrucciones completas próximamente en Sprint 1)*

## 📐 Arquitectura
Este proyecto sigue una arquitectura por capas:
- `modules/` — Cada módulo de negocio (auth, patients, appointments...)
- `config/` — Configuración (BD, entorno, logs)
- `middlewares/` — Middlewares de Express (auth, RBAC, validación)
- `shared/` — Utilidades y errores reutilizables

## 👤 Autor
Proyecto de graduación — Gabriel
