#!/bin/bash
# 获取真实的方案数据用于测试

TOKEN="MzE4NjgwNzY4NUBxcS5jb20kMTc3NDkzOTQ4NA-4163eb1f20d95599a97fa28dbe9962db0fc98310a267233b74466bf497cdb692"

curl -s -X GET "http://1.117.207.253:7072/api/sip/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | {id, schemeName, description, boundPhoneNumber, isActive, enabled, autoAnswer, assistantId}'
