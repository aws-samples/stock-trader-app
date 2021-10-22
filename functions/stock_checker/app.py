import boto3
import logging
import os

from random import randrange
from urllib.request import urlopen
from random import randint

# It is not recommended to enable DEBUG logs in production,
# this is just to show an example of a recommendation
# by Amazon CodeGuru Profiler.
logging.getLogger('botocore').setLevel(logging.DEBUG)

SITE = 'http://www.python.org/'
CW_NAMESPACE = 'ProfilerPythonDemo'
S3_BUCKET = os.environ['S3_BUCKET']



def lambda_handler(event, context):
    """Sample Lambda function which mocks the operation of checking the current price 
    of a stock.

    For demonstration purposes this Lambda function simply returns 
    a random integer between 0 and 100 as the stock price.

    Parameters
    ----------
    event: dict, required
        Input event to the Lambda function

    context: object, required
        Lambda Context runtime methods and attributes

    Returns
    ------
        dict: Object containing the current price of the stock
    """
    # Check current price of the stock
    stock_price = randint(
        0, 100
    )  # Current stock price is mocked as a random integer between 0 and 100
        # Make some network calls using urllib and s3 client.
    with urlopen(SITE) as response:
        s3_client = boto3.client('s3')
        s3_client.put_object(Body=response.read(),
                             Bucket=S3_BUCKET,
                             Key='response.txt')

    # Publish metrics.
    content_length = int(response.headers['Content-Length'])
    put_metric('ResponseContentLength', content_length)
    put_metric(str(response.status)[0] + 'xxStatus', 1)

    # Generate some CPU-intensive work.
    num = randrange(content_length)
    count = 0
    for _ in range(num):
        x = randrange(num)
        if check_prime(x):
            count += 1
    return {"stock_price": stock_price}
    
def put_metric(name, value):
    cw_client = boto3.client('cloudwatch')
    metric_data_num = [{'MetricName': name, 'Value': value}]
    cw_client.put_metric_data(Namespace=CW_NAMESPACE, MetricData=metric_data_num)


def check_prime(num):
    if num == 1 or num == 0:
        return False
    sq_root = 2
    while sq_root * sq_root <= num:
        if num % sq_root == 0:
            return False
        sq_root += 1
    return True


