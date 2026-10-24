"""
Evaluation dataset for diagram generation and edit modes across all supported diagram types.
Contains 8 generate prompts and 5 edit prompts per diagram type (52 total test cases).
"""

EVAL_DATASET = {
    "flowchart-diagram": {
        "generate": [
            {
                "id": "flow-gen-1",
                "prompt": "User signup with email verification, password strength checks, and SMS OTP fallback."
            },
            {
                "id": "flow-gen-2",
                "prompt": "E-commerce order fulfillment from cart checkout through payment authorization, stock pack, and carrier handover."
            },
            {
                "id": "flow-gen-3",
                "prompt": "Bug triage workflow: issue submission, severity assessment, engineering assignment, review, and QA verification."
            },
            {
                "id": "flow-gen-4",
                "prompt": "CI/CD deployment pipeline: git push trigger, static linting, unit tests, docker build, staging deployment, and production release."
            },
            {
                "id": "flow-gen-5",
                "prompt": "Customer support ticket escalation matrix based on SLA tier (P1 critical, P2 high, P3 normal)."
            },
            {
                "id": "flow-gen-6",
                "prompt": "Multi-factor authentication (MFA) challenge with push notification and time-based authenticator app approval."
            },
            {
                "id": "flow-gen-7",
                "prompt": "Mortgage loan risk assessment: credit score inquiry, debt-to-income calculation, underwriter review, and approval."
            },
            {
                "id": "flow-gen-8",
                "prompt": "Hotel room reservation and cancellation lifecycle with deposit refund policy windows."
            }
        ],
        "edit": [
            {
                "id": "flow-edit-1",
                "prompt": "Add an SMS OTP fallback node after email verification timeout.",
                "initial_code": "title User Verification\ndirection down\n\nStart [shape: oval]\nEmailForm [shape: rectangle]\nVerifyEmail [shape: diamond]\nSuccess [shape: oval, color: green]\n\nStart > EmailForm\nEmailForm > VerifyEmail\nVerifyEmail > Success: verified"
            },
            {
                "id": "flow-edit-2",
                "prompt": "Add a refund gate node when the order is cancelled.",
                "initial_code": "title Order Flow\ndirection down\n\nCheckout > Payment\nPayment > Pack: authorized\nPayment > Cancelled: declined"
            },
            {
                "id": "flow-edit-3",
                "prompt": "Insert a security vulnerability scanning step between build and unit tests.",
                "initial_code": "title CI Pipeline\ndirection right\n\nGitPush > Build\nBuild > UnitTests\nUnitTests > Deploy"
            },
            {
                "id": "flow-edit-4",
                "prompt": "Change the database node shape to cylinder and color to purple.",
                "initial_code": "title Data Pipeline\ndirection down\n\nIngest > Transform\nTransform > Database [shape: rectangle, color: blue]"
            },
            {
                "id": "flow-edit-5",
                "prompt": "Rename the approval step from 'Manual Review' to 'Compliance Audit'.",
                "initial_code": "title Approval Pipeline\ndirection down\n\nSubmission > ManualReview: submit for check\nManualReview > Approved: pass"
            }
        ]
    },
    "cloud-architecture-diagram": {
        "generate": [
            {
                "id": "cloud-gen-1",
                "prompt": "Serverless web application on AWS with Route 53 DNS, CloudFront CDN, S3 static hosting, and API Gateway to Lambda."
            },
            {
                "id": "cloud-gen-2",
                "prompt": "High availability microservices architecture on AWS ECS Fargate with Application Load Balancer, Redis cache, and Aurora PostgreSQL."
            },
            {
                "id": "cloud-gen-3",
                "prompt": "Multi-region Kubernetes cluster architecture on GCP using GKE, Cloud Armor WAF, Cloud Load Balancing, and Cloud Spanner."
            },
            {
                "id": "cloud-gen-4",
                "prompt": "Real-time IoT telemetry ingestion stream using AWS IoT Core, Kinesis Data Streams, Lambda processors, and Timestream database."
            },
            {
                "id": "cloud-gen-5",
                "prompt": "Enterprise data lakehouse architecture with Snowflake storage, dbt transformation models, Apache Airflow scheduler, and AWS S3."
            },
            {
                "id": "cloud-gen-6",
                "prompt": "Azure enterprise hybrid network architecture connecting on-premise datacenter via ExpressRoute to Virtual WAN, AKS, and Cosmos DB."
            },
            {
                "id": "cloud-gen-7",
                "prompt": "Event-driven transactional payment pipeline on AWS using EventBridge bus, SQS dead-letter queues, and Step Functions state machines."
            },
            {
                "id": "cloud-gen-8",
                "prompt": "Disaster recovery active-passive hot-standby architecture across AWS us-east-1 and us-west-2 with Route 53 health check failover."
            }
        ],
        "edit": [
            {
                "id": "cloud-edit-1",
                "prompt": "Add an ElastiCache Redis cluster between the API gateway and the database.",
                "initial_code": "title Web App Cloud\ndirection right\n\nCloudFront > APIGateway\nAPIGateway > Lambda\nLambda > AuroraDB"
            },
            {
                "id": "cloud-edit-2",
                "prompt": "Add AWS WAF in front of the CloudFront distribution to inspect incoming requests.",
                "initial_code": "title Edge Architecture\ndirection right\n\nUsers > CloudFront\nCloudFront > S3Bucket"
            },
            {
                "id": "cloud-edit-3",
                "prompt": "Enclose the ECS tasks and Database inside a Private Subnet group.",
                "initial_code": "title Microservices\ndirection down\n\nALB > ECSTask\nECSTask > AuroraDB"
            },
            {
                "id": "cloud-edit-4",
                "prompt": "Change the storage bucket color to yellow and add a cross-region replication replica bucket.",
                "initial_code": "title Storage Tier\ndirection right\n\nPrimaryBucket [color: blue]\nAppService > PrimaryBucket"
            },
            {
                "id": "cloud-edit-5",
                "prompt": "Rename APIGateway to KongGateway and change its shape to rectangle.",
                "initial_code": "title Gateway Setup\ndirection down\n\nClients > APIGateway: HTTP\nAPIGateway > InternalService"
            }
        ]
    },
    "sequence-diagram": {
        "generate": [
            {
                "id": "seq-gen-1",
                "prompt": "OAuth2 Authorization Code Grant flow with PKCE between Browser, Client SPA, and Authorization Server."
            },
            {
                "id": "seq-gen-2",
                "prompt": "Stripe credit card charge workflow with 3D-Secure bank challenge and asynchronous webhook receipt."
            },
            {
                "id": "seq-gen-3",
                "prompt": "Real-time WebSocket chat connection negotiation, room subscription, and message broadcast."
            },
            {
                "id": "seq-gen-4",
                "prompt": "Enterprise Single Sign-On (SSO) SAML 2.0 authentication exchange between User Agent, Service Provider, and Identity Provider."
            },
            {
                "id": "seq-gen-5",
                "prompt": "Distributed travel booking Saga orchestration across FlightService, HotelService, and CarRentalService with compensation on failure."
            },
            {
                "id": "seq-gen-6",
                "prompt": "Cache-aside read through pattern: API checks Redis cache, on cache miss queries PostgreSQL database, and populates cache with TTL."
            },
            {
                "id": "seq-gen-7",
                "prompt": "Video streaming media negotiation with RTSP DESCRIBE, SETUP, and RTP packet transmission."
            },
            {
                "id": "seq-gen-8",
                "prompt": "Distributed lock acquisition with Redis Redlock algorithm across multi-node cluster and heartbeat lease renewal."
            }
        ],
        "edit": [
            {
                "id": "seq-edit-1",
                "prompt": "Add SMS 2FA prompt message from AuthServer to User before issuing the code.",
                "initial_code": "title OAuth Flow\norder User, Client, AuthServer\n\nUser > Client: Click Login\nClient > AuthServer: Request Auth Code\nAuthServer --> Client: 302 Redirect with Code"
            },
            {
                "id": "seq-edit-2",
                "prompt": "Add a loop block for connection retries when contacting PaymentAPI.",
                "initial_code": "title Payment Flow\norder Merchant, PaymentAPI\n\nMerchant > PaymentAPI: Charge Card\nPaymentAPI --> Merchant: 200 Success"
            },
            {
                "id": "seq-edit-3",
                "prompt": "Insert a token refresh request when a 401 Unauthorized status is returned.",
                "initial_code": "title API Request\norder App, Gateway\n\nApp > Gateway: GET /profile (token)\nGateway --> App: 401 Unauthorized"
            },
            {
                "id": "seq-edit-4",
                "prompt": "Activate AuthServer during credential validation and deactivate it after token issuance.",
                "initial_code": "title Token Exchange\norder Client, AuthServer\n\nClient > AuthServer: POST /token\nAuthServer --> Client: 200 OK (access_token)"
            },
            {
                "id": "seq-edit-5",
                "prompt": "Rename participant Browser to MobileApp and Client to APIBackend.",
                "initial_code": "title Auth Check\norder Browser, Client\n\nBrowser > Client: Check Session\nClient --> Browser: Session Valid"
            }
        ]
    },
    "erd-diagram": {
        "generate": [
            {
                "id": "erd-gen-1",
                "prompt": "Multi-tenant SaaS billing database schema: Organizations, Users, Invoices, Subscriptions, and PaymentMethods."
            },
            {
                "id": "erd-gen-2",
                "prompt": "Hospital healthcare management database: Doctors, Patients, Appointments, MedicalRecords, and Prescriptions."
            },
            {
                "id": "erd-gen-3",
                "prompt": "E-commerce marketplace relational model: Sellers, Products, ProductVariants, Inventory, Orders, OrderItems, and CustomerReviews."
            },
            {
                "id": "erd-gen-4",
                "prompt": "Social networking graph schema: Users, Friendships, Posts, Comments, and PostReactions."
            },
            {
                "id": "erd-gen-5",
                "prompt": "University academic registration database: Departments, Instructors, Courses, Sections, Students, and Enrollments."
            },
            {
                "id": "erd-gen-6",
                "prompt": "Music streaming platform catalog schema: Artists, RecordLabels, Albums, Tracks, UserPlaylists, and StreamPlays."
            },
            {
                "id": "erd-gen-7",
                "prompt": "Real estate property listing database: Brokerages, Agents, Properties, PropertyImages, and BuyerOffers."
            },
            {
                "id": "erd-gen-8",
                "prompt": "Double-entry accounting ledger system: Accounts, JournalEntries, LedgerPostings, Currencies, and AuditLogs."
            }
        ],
        "edit": [
            {
                "id": "erd-edit-1",
                "prompt": "Add workspace_id string fk to Users table and create 1:N relationship from Workspaces to Users.",
                "initial_code": "title App Schema\nnotation crows-foot\n\nWorkspaces {\n  id string pk\n  name string\n}\n\nUsers {\n  id string pk\n  email string unique\n}"
            },
            {
                "id": "erd-edit-2",
                "prompt": "Add status string and tracking_number string nullable columns to Orders table.",
                "initial_code": "title Store Schema\n\nOrders {\n  id string pk\n  total_amount number\n  created_at timestamp\n}"
            },
            {
                "id": "erd-edit-3",
                "prompt": "Add a unique constraint to the username column in the Profiles table.",
                "initial_code": "title User Profiles\n\nProfiles {\n  id string pk\n  user_id string fk\n  username string\n}"
            },
            {
                "id": "erd-edit-4",
                "prompt": "Change notation to crows-foot and add discount_code string nullable to Invoices.",
                "initial_code": "title Billing Schema\nnotation chen\n\nInvoices {\n  id string pk\n  amount number\n}"
            },
            {
                "id": "erd-edit-5",
                "prompt": "Add a 1:M relationship connection from Customers to SupportTickets.",
                "initial_code": "title CRM Schema\nnotation crows-foot\n\nCustomers {\n  id string pk\n  name string\n}\n\nSupportTickets {\n  id string pk\n  customer_id string fk\n  subject string\n}"
            }
        ]
    }
}
