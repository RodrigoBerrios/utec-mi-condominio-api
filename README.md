# Mi Condominio API

API para gestión de condominios usando AWS Lambda, Serverless Framework y Amazon Athena.

## 📚 Documentación API (Swagger)

La API cuenta con documentación completa en formato OpenAPI/Swagger.

### Generar y visualizar documentación:

```bash
# Generar documentación OpenAPI
npm run docs:generate

# Servir documentación en navegador
npm run docs:serve

# Generar colección de Postman
npm run docs:postman
```

## 🚀 Endpoints disponibles

### 1. **Cuotas**
- `GET /cuotas` - Obtener todas las cuotas
- `GET /cuotas-pagadas?periodo=2025-01` - Total de cuotas pagadas (opcional filtro por periodo)
- `GET /cuotas-vencidas?periodo=2025-01` - Total de cuotas vencidas (opcional filtro por periodo)

### 2. **Gastos**
- `GET /gastos?periodo=2025-01` - Total de gastos (opcional filtro por periodo)

### 3. **Presupuesto**
- `GET /presupuesto` - Obtener información del presupuesto

### 4. **Deudores**
- `GET /deudores?periodo=2025-01` - Lista de deudores con monto total (opcional filtro por periodo)

## 📋 Parámetros de Query

Todos los endpoints que soportan filtros por periodo aceptan el parámetro:
- `periodo`: Formato `YYYY-MM` (ejemplo: `2025-01`)

## 🔧 Ejemplo de respuestas

### Obtener total de gastos
```bash
GET /gastos?periodo=2025-01
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Total de gastos obtenido exitosamente",
  "totalGastos": 15000.50,
  "periodo": "2025-01",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### Obtener lista de deudores
```bash
GET /deudores?periodo=2025-01
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Lista de deudores obtenida exitosamente",
  "totalDeudores": 3,
  "deudores": [
    {
      "idDepartamento": "101",
      "totalMonto": 1500.50,
      "nombreResponsable": "Juan Pérez"
    },
    {
      "idDepartamento": "102",
      "totalMonto": 2000.00,
      "nombreResponsable": "María González"
    }
  ],
  "periodo": "2025-01",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

## ⚙️ Configuración

### Variables de entorno:
- `ATHENA_DATABASE`: Base de datos de Athena (default: `micondominio_lakehouse_db`)
- `ATHENA_WORKGROUP`: Grupo de trabajo de Athena (default: `primary`)
- `ATHENA_OUTPUT_LOCATION`: Ubicación S3 para resultados (default: `s3://g2-mi-condominio-athenas/temp-sql/`)

### 🛠 Instalación

```bash
npm install
```

### 🚀 Desarrollo local

```bash
# Ejecutar en modo offline
npm run offline

# Generar documentación Swagger
npm run docs:generate

# Servir documentación en navegador
npm run docs:serve
```

### 📦 Despliegue

```bash
# Desplegar en desarrollo
npm run deploy

# Desplegar en producción
npm run deploy:prod
```

## 📁 Estructura del proyecto

```
mi-condominio-api/
├── src/
│   └── functions/
│       ├── getCuotas.js              # Obtener todas las cuotas
│       ├── getPresupuesto.js         # Obtener presupuesto
│       ├── getTotalGastos.js         # Total de gastos por periodo
│       ├── getTotalCuotasPagadas.js  # Total de cuotas pagadas
│       ├── getTotalCuotasVencidas.js # Total de cuotas vencidas
│       └── getDeudores.js            # Lista de deudores
├── docs/
│   └── ATHENA_SETUP.md              # Configuración de Athena
├── serverless.yml                   # Configuración de Serverless + Swagger
├── package.json
└── README.md
```

## 🔐 Permisos IAM requeridos

```yaml
- Effect: Allow
  Action:
    - athena:StartQueryExecution
    - athena:GetQueryExecution
    - athena:GetQueryResults
    - athena:GetWorkGroup
    - athena:ListWorkGroups
    - glue:GetDatabase
    - glue:GetTable
    - glue:GetPartitions
    - s3:GetBucketLocation
    - s3:GetObject
    - s3:ListBucket
    - s3:PutObject
  Resource: "*"
```

## 📖 Ejemplos de uso

### Obtener todas las cuotas
```bash
curl -X GET https://tu-api-gateway-url/cuotas
```

### Obtener gastos de enero 2025
```bash
curl -X GET "https://tu-api-gateway-url/gastos?periodo=2025-01"
```

### Obtener lista de deudores
```bash
curl -X GET "https://tu-api-gateway-url/deudores?periodo=2025-01"
```

## 🏗 Arquitectura

- **AWS Lambda**: Funciones serverless para procesamiento
- **Amazon Athena**: Motor de consultas SQL sobre S3
- **API Gateway**: Exposición de endpoints REST
- **OpenAPI/Swagger**: Documentación automática de la API
- **Serverless Framework**: Infraestructura como código

## 📊 Tablas de Athena utilizadas

- `micondominio_lakehouse_db.g2_cuotas_tb`: Tabla de cuotas
- `micondominio_lakehouse_db.g2_gastos_tb`: Tabla de gastos  
- `micondominio_lakehouse_db.g2_inquilinos_tb`: Tabla de inquilinos
- `micondominio_lakehouse_db.g2_propietarios_tb`: Tabla de propietarios 