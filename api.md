Latest update:
2024-05-28 16:27:55
5511
QueryTransactionDetails
GET
/finance/transaction/details/get
Description：API to query seller transaction details within specific date range.
Service Endpoints
Region
Endpoint
Myanmar
https://api.shop.com.mm/rest
Bangladesh
https://api.daraz.com.bd/rest
Pakistan
https://api.daraz.pk/rest
Sri Lanka
https://api.daraz.lk/rest
Nepal
https://api.daraz.com.np/rest
Common Parameters
Name
Type
Required or not
Description
app_key
String
Yes
Unique app ID issued by DARAZ Open Platform console when you apply for an app category
timestamp
String
Yes
The time stamp of the request e.g. 1517820392000 (which translates to 5 February 2018 08:46:32) with less than 7200s difference from UTC time
access_token
String
Yes
API interface call credentials
sign_method
String
Yes
The HMAC hash algorithm you are using to calculate your signature
sign
String
Yes
Part of the authentication process that is used for identifying and verifying who is sending a request (click <a target='_blank' href='https://open.daraz.com/doc/doc.htm#?nodeId=10450&docId=108068'>here</a> for details)
Parameter
Name
Type
Required or not
Description
offset
String
No
Number of transaction lines to skip at the beginning of the list.
trans_type
String
No
Transaction type ID.
trade_order_id
String
No
Order ID.
limit
String
No
Number of lines of transactions to be extracted. The supported maximum number is 500.
start_time
String
Yes
Starting date when transactions need to be extracted.
end_time
String
Yes
Ending date when transactions need to be extracted.
trade_order_line_id
String
No
Order Item ID.
Response Parameters
Name
Type
Description
data
Object[]
Response body
Error code
Error code
Error message
Solution
1000012
endTime - startTime must should be less than 180 days
endTime - startTime must should be less than 180 days
1000014
Can not find that transactionType
transaction type invalid
GET
/finance/transaction/details/get
JAVA
PHP
.NET
RUBY
PYTHON
CURL
IopClient client = new IopClient(url, appkey, appSecret);
IopRequest request = new IopRequest();
request.setApiName("/finance/transaction/details/get");
request.setHttpMethod("GET");
request.addApiParameter("offset", "0");
request.addApiParameter("trans_type", "-1");
request.addApiParameter("trade_order_id", "123123213213");
request.addApiParameter("limit", "100");
request.addApiParameter("start_time", "2021-01-01");
request.addApiParameter("end_time", "2021-01-05");
request.addApiParameter("trade_order_line_id", "45645674566");
IopResponse response = client.execute(request, accessToken);
System.out.println(response.getBody());
Thread.sleep(10);

Streamlined Return
{
  "code": "0",
  "data": [
    {
      "order_no": "123445666666",
      "transaction_date": "17 May 2016",
      "amount": "-0.62",
      "paid_status": "Not paid",
      "shipping_provider": "LEX",
      "WHT_included_in_amount": "Yes",
      "payment_ref_id": "paymentRefId",
      "lazada_sku": "Item test -123",
      "fee_type": "13",
      "transaction_type": "Payment Fee",
      "orderItem_no": "1666666",
      "orderItem_status": "orderItemStatus",
      "reference": "1340",
      "fee_name": "feeName",
      "shipping_speed": "shippingSpeed",
      "WHT_amount": "0.0112",
      "transaction_number": "SG103EF-1P9VK1A",
      "seller_sku": "sellerSKU",
      "statement": "11 May 2016 - 17 May 2016",
      "details": "details",
      "comment": "comment",
      "VAT_in_amount": "0.0672",
      "shipment_type": "Dropshipping"
    }
  ],
  "request_id": "0ba2887315178178017221014"
}


Latest update:
2023-07-22 10:32:45
4439
GetPayoutStatus
GET
/finance/payout/status/get
Description：Get your transaction statements created after the provided date
Service Endpoints
Region
Endpoint
Myanmar
https://api.shop.com.mm/rest
Bangladesh
https://api.daraz.com.bd/rest
Pakistan
https://api.daraz.pk/rest
Sri Lanka
https://api.daraz.lk/rest
Nepal
https://api.daraz.com.np/rest
Common Parameters
Name
Type
Required or not
Description
app_key
String
Yes
Unique app ID issued by DARAZ Open Platform console when you apply for an app category
timestamp
String
Yes
The time stamp of the request e.g. 1517820392000 (which translates to 5 February 2018 08:46:32) with less than 7200s difference from UTC time
access_token
String
Yes
API interface call credentials
sign_method
String
Yes
The HMAC hash algorithm you are using to calculate your signature
sign
String
Yes
Part of the authentication process that is used for identifying and verifying who is sending a request (click <a target='_blank' href='https://open.daraz.com/doc/doc.htm#?nodeId=10450&docId=108068'>here</a> for details)
Parameter
Name
Type
Required or not
Description
created_after
String
Yes
Filter statements created after the provided date. Mandatory.
Response Parameters
Name
Type
Description
data
Object[]
Response body
Error code
Error code
Error message
Solution
No Data
GET
/finance/payout/status/get
JAVA
PHP
.NET
RUBY
PYTHON
CURL
IopClient client = new IopClient(url, appkey, appSecret);
IopRequest request = new IopRequest();
request.setApiName("/finance/payout/status/get");
request.setHttpMethod("GET");
request.addApiParameter("created_after", "2018-01-01");
IopResponse response = client.execute(request, accessToken);
System.out.println(response.getBody());
Thread.sleep(10);

Streamlined Return
{
  "code": "0",
  "data": [
    {
      "subtotal2": "51.20",
      "subtotal1": "51.20",
      "shipment_fee_credit": "51.20",
      "payout": "0.00 PKR",
      "item_revenue": "0",
      "created_at": "2021-03-01 00:09:18",
      "other_revenue_total": "0",
      "fees_total": "51.20",
      "refunds": "0",
      "guarantee_deposit": "0",
      "fees_on_refunds_total": "0",
      "updated_at": "2018-01-04 00:23:04",
      "closing_balance": "-1500.63",
      "paid": "0",
      "opening_balance": "-1459.23",
      "statement_number": "PK1KZOB-2021-02006",
      "shipment_fee": "51.20"
    }
  ],
  "request_id": "0ba2887315178178017221014"
}
