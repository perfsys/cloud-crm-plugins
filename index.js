'use strict'

const serverless = require('serverless-http')
const AWS = require('aws-sdk')
const express = require('express')

const app = express()

app.get('/', async function(request, response) {
  const CSV = require('csv')
  const sortObject = require('sort-object')

  let keysOrder = Object.keys(require('./csv-template.js')).sort()

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
    return new Promise(function(resolve, reject) {
      data.forEach(function(item) {
        keysOrder.forEach(function(prop) {
          if(!(prop in item)) item[prop] = null
        })
        csvTable.push(Object.values(sortObject(item, keysOrder)))
      })
      resolve(csvTable)
    })
  }
  const csvStringify = function(table) {
    return new Promise(function(resolve, reject) {
      CSV.stringify(table, {
        header: true,
        columns: keysOrder
      }, function(err, data) {
        if(err != null) reject(err)
        else resolve(data)
      })
    })
  }

  try {
    let tableInfo, csvTable = []

    tableInfo = await getTableContent(process.env.CRM_CONTACTS_TABLE_ARN.split('/')[1])
    csvTable = csvTable.concat(await csvTableFormatter(tableInfo))

    tableInfo = await getTableContent(process.env.CRM_GROUPS_TABLE_ARN.split('/')[1])
    csvTable = csvTable.concat(await csvTableFormatter(tableInfo))

    tableInfo = await getTableContent(process.env.CRM_UPDATES_TABLE_ARN.split('/')[1])
    csvTable = csvTable.concat(await csvTableFormatter(tableInfo))

    tableInfo = await getTableContent(process.env.CRM_COMPANIES_TABLE_ARN.split('/')[1])
    csvTable = csvTable.concat(await csvTableFormatter(tableInfo))

    var csvString = await csvStringify(csvTable)
  }
  catch(err) {
    console.log('Error: ' + JSON.stringify(err))
    response.end('Error')
  }

  let params = {
    Bucket: process.env.UNIVERSAL_STORAGE_ARN.split(':::')[1],
    Key: 'cloud-crm-data-backup.csv',
    Body: csvString
  }
  console.log(process.env.UNIVERSAL_STORAGE_ARN)

  S3.upload(params, function (err, data) {
    if (err) {
      console.log(JSON.stringify(err))
      response.end('Error')
    }
    else {
      console.log(JSON.stringify(data))
      response.end('Success')
    }
  })
})

module.exports.handler = serverless(app)
