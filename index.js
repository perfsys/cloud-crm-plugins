'use strict'

const AWS = require('aws-sdk')
const CSV = require('csv')
const sortObject = require('sort-object')

let keysOrder = Object.keys(require('./csv-template.js'))

const DynamoDB = new AWS.DynamoDB.DocumentClient()
const S3 = new AWS.S3()

const getTableContent = function(tableName) {
  return new Promise(function(resolve, reject) {
    DynamoDB.scan({ TableName: tableName }, function(err, data) {
      if(err != null) reject(err)
      else resolve(data.Items)
    })
  })
}
const csvTableFormatter = function(data) {
  let csvTable = []
  data.forEach(function(item) {
    keysOrder.forEach(function(prop) {
      if(!(prop in item)) item[prop] = null
    })
    csvTable.push(Object.values(sortObject(item, keysOrder)))
  })
  return csvTable
}
const csvStringify = function(table) {
  return new Promise(function(resolve, reject) {
    CSV.stringify(table, {
      header: true,
      columns: Object.values(require('./csv-template.js'))
    }, function(err, data) {
      if(err != null) reject(err)
      else resolve(data)
    })
  })
}
const csvToS3 = function(csvFile, bucketName) {
  return new Promise(function(resolve, reject) {
    let params = {
      Bucket: bucketName,
      Key: csvFile.name + '.csv',
      Body: csvFile.text
    }
    S3.upload(params, function(err, data) {
      if(err != null) reject(err)
      else resolve(data)
    })
  })
}

module.exports.handler = async function(event, context, callback) {
  console.log(event)
  try {
    let csvTable = []

    csvTable = csvTable.concat(csvTableFormatter(await getTableContent(process.env.CRM_CONTACTS_TABLE_ARN.split('/')[1])))
    csvTable = csvTable.concat(csvTableFormatter(await getTableContent(process.env.CRM_GROUPS_TABLE_ARN.split('/')[1])))
    csvTable = csvTable.concat(csvTableFormatter(await getTableContent(process.env.CRM_UPDATES_TABLE_ARN.split('/')[1])))
    csvTable = csvTable.concat(csvTableFormatter(await getTableContent(process.env.CRM_COMPANIES_TABLE_ARN.split('/')[1])))

    await csvToS3({name: 'cloud-crm-data-backup', text: await csvStringify(csvTable)}, process.env.UNIVERSAL_STORAGE_ARN.split(':::')[1])
  }
  catch(err) {
    console.log('Error: ' + JSON.stringify(err))
  }
}
