豆包语音
文档指南
请输入

文档首页

豆包语音

开发参考

音频生成

语音合成

在线语音合成API

HTTP接口(一次性合成-非流式)

复制全文
我的收藏
HTTP接口(一次性合成-非流式)
此文档主要是说明 TTS HTTP 接口如何调用。

1. 接口说明 #
接口地址为 https://openspeech.bytedance.com/api/v1/tts


2. 身份认证 #
认证方式采用 Bearer Token.
1)需要在请求的 Header 中填入"Authorization":"Bearer;${token}"

注意

Bearer和token使用分号 ; 分隔，替换时请勿保留${}

AppID/Token/Cluster 等信息可参考 控制台使用FAQ-Q1

3. 请求方式 #

3.1 请求参数 #
参考文档：参数基本说明

3.2 返回参数 #
参考文档：参数基本说明

4. 注意事项 #
使用 HTTP Post 方式进行请求，返回的结果为 JSON 格式，需要进行解析
因 json 格式无法直接携带二进制音频，音频经base64编码。使用base64解码后，即为二进制音频
每次合成时 reqid 这个参数需要重新设置，且要保证唯一性（建议使用 UUID/GUID 等生成）