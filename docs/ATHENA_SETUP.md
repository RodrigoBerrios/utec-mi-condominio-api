# Configuración de Amazon Athena

Esta guía te ayudará a configurar Amazon Athena para usar con la función Lambda `queryAthena`.

## 🚀 Prerrequisitos

1. **Cuenta de AWS** con acceso a Athena
2. **Bucket S3** para almacenar los resultados de las consultas
3. **Datos en S3** o **Glue Data Catalog** configurado
4. **WorkGroup de Athena** (opcional, se puede usar el primary)

## 📋 Configuración Paso a Paso

### 1. Crear un Bucket S3 para Resultados

```bash
# Crear bucket para resultados de Athena
aws s3 mb s3://mi-condominio-athena-results

# Crear carpeta para resultados
aws s3 mkdir s3://mi-condominio-athena-results/query-results/
```

### 2. Configurar Permisos IAM

La función Lambda necesita los siguientes permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "athena:StartQueryExecution",
        "athena:GetQueryExecution",
        "athena:GetQueryResults",
        "athena:GetWorkGroup",
        "athena:ListWorkGroups",
        "athena:ListDataCatalogs",
        "athena:ListDatabases",
        "athena:ListTables"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::mi-condominio-athena-results",
        "arn:aws:s3:::mi-condominio-athena-results/*"
      ]
    }
  ]
}
```

### 3. Actualizar Variables de Entorno

Edita el archivo `serverless.yml` en la sección `custom.athena`:

```yaml
custom:
  athena:
    database: 'mi_condominio_db'  # Tu base de datos
    workgroup: 'primary'          # Tu workgroup
    outputLocation: 's3://mi-condominio-athena-results/query-results/'
```

### 4. Crear Base de Datos y Tablas (Ejemplo)

```sql
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS mi_condominio_db;

-- Crear tabla de residentes
CREATE EXTERNAL TABLE mi_condominio_db.residentes (
  id STRING,
  nombre STRING,
  apellido STRING,
  email STRING,
  telefono STRING,
  unidad STRING,
  fecha_registro TIMESTAMP,
  estado STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://mi-condominio-data/residentes/';

-- Crear tabla de pagos
CREATE EXTERNAL TABLE mi_condominio_db.pagos (
  id STRING,
  residente_id STRING,
  monto DECIMAL(10,2),
  fecha_pago DATE,
  concepto STRING,
  estado STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://mi-condominio-data/pagos/';
```

## 🔧 Configuración de la Función

### Variables de Entorno Requeridas

```bash
ATHENA_DATABASE=mi_condominio_db
ATHENA_WORKGROUP=primary
ATHENA_OUTPUT_LOCATION=s3://mi-condominio-athena-results/query-results/
```

### Ejemplo de Uso

```bash
# Ejecutar consulta simple
curl -X POST https://your-api-gateway-url/dev/athena/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM mi_condominio_db.residentes LIMIT 10",
    "limit": 100
  }'

# Consulta con JOIN
curl -X POST https://your-api-gateway-url/dev/athena/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT r.nombre, r.apellido, r.unidad, COUNT(p.id) as total_pagos FROM mi_condominio_db.residentes r LEFT JOIN mi_condominio_db.pagos p ON r.id = p.residente_id GROUP BY r.id, r.nombre, r.apellido, r.unidad",
    "limit": 50
  }'
```

## 📊 Ejemplo de Respuesta

```json
{
  "success": true,
  "message": "Consulta ejecutada exitosamente",
  "data": {
    "queryExecutionId": "12345678-1234-1234-1234-123456789012",
    "query": "SELECT * FROM mi_condominio_db.residentes LIMIT 10",
    "executionTime": 2500,
    "dataScanned": 1048576,
    "rowsReturned": 10,
    "results": [
      {
        "Data": [
          {"VarCharValue": "res-001"},
          {"VarCharValue": "Juan"},
          {"VarCharValue": "Pérez"},
          {"VarCharValue": "juan.perez@email.com"},
          {"VarCharValue": "A-101"}
        ]
      }
    ],
    "headers": ["id", "nombre", "apellido", "email", "unidad"]
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## ⚠️ Consideraciones de Seguridad

1. **Solo consultas SELECT**: La función está configurada para permitir solo consultas SELECT
2. **Validación de SQL**: Se valida que no contenga palabras clave peligrosas
3. **Límite de resultados**: Se aplica un límite por defecto de 1000 filas
4. **Timeout**: Las consultas tienen un timeout de 5 minutos

## 🛠️ Solución de Problemas

### Error: "Access Denied"
- Verificar permisos IAM de la función Lambda
- Confirmar que el bucket S3 existe y es accesible

### Error: "Database not found"
- Crear la base de datos en Athena
- Verificar que el nombre de la base de datos sea correcto

### Error: "Query timeout"
- Optimizar la consulta SQL
- Aumentar el timeout en la función si es necesario

### Error: "Invalid output location"
- Verificar que el bucket S3 existe
- Confirmar que la ruta de salida es correcta
- Verificar permisos de escritura en el bucket

## 📈 Optimización

1. **Particionamiento**: Usar particiones en las tablas para mejorar el rendimiento
2. **Compresión**: Usar formatos comprimidos como Parquet
3. **Límites**: Aplicar LIMIT en las consultas para evitar escaneos grandes
4. **Índices**: Usar Glue Data Catalog para optimizar las consultas 