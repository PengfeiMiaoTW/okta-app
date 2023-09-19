# GCP - Connecting to Cloud SQL using workload identity federation in GKE

The following documentation explains how to connect to Cloud SQL from Google Kubernetes Engine using workload identity federation.

Cloud SQL can be accessed from GKE using service account impersonation. But, the problem with service-account keys is that it needs to be securely maintained and rotated periodically. 

We can leverage [workload identity federation](https://cloud.google.com/iam/docs/workload-identity-federation) in GKE clusters through which we can impersonate IAM service accounts to access Google Cloud services without using service-account keys.

## Steps to enable workload identity for GKE

1. Create a service-account in GCP IAM and grant the required permissions to access cloud sql using the [instructions](https://cloud.google.com/iam/docs/manage-access-service-accounts#iam-grant-single-role-sa-gcloud).

2. Create a new cluster and node pool with workload identity enabled

   a. If GKE cluster does not exist we can create a new cluster with workload identity enabled using the below command
    ```sh
    gcloud container clusters create ${CLUSTER_NAME} \
        --region=${COMPUTE_REGION} \
        --workload-pool=${GCP_PROJECT_ID}.svc.id.goog
    ```

   b. Enable workload identity while creation of new node pool using the below command
    ```sh
    gcloud container node-pools create ${NODEPOOL_NAME} \
        --cluster=${CLUSTER_NAME} \
        --region=${COMPUTE_REGION} \
        --workload-metadata=GKE_METADATA
    ```

3. Enable workload identity for existing cluster and node pool <br/>
**Note: Enabling workload identity in existing node-pool will result in downtime**
    
    a. If GKE cluster is already existing we can enable workload identity using the below command
    ```sh
    gcloud container clusters update ${CLUSTER_NAME} \
        --region=${COMPUTE_REGION} \
        --workload-pool=${PROJECT_ID}.svc.id.goog
    ```

    b. Enable workload identity to existing node pool using the below command
    ```sh
    gcloud container node-pools update ${NODEPOOL_NAME} \
        --cluster=${CLUSTER_NAME} \
        --region=${COMPUTE_REGION} \
        --workload-metadata=GKE_METADATA
    ```

 4. Create kubernets service account using the below config yaml file
    ```yaml
    apiVersion: v1
    kind: ServiceAccount
    metadata:
      annotations:
        iam.gke.io/gcp-service-account: ${GCP_SERVICE_ACCOUNT_NAME}@${GOOGLE_PROJECT_ID}.iam.gserviceaccount.com
      name: ${KUBERNETES_SERVICE_ACCOUNT_NAME}
      namespace: ${NAMESPACE}
    ``` 

 5. Add IAM policy binding between GCP service account and kubernetes service account by running the following gcloud command

    ```sh
    gcloud iam service-accounts 
        add-iam-policy-binding ${GCP_SERVICE_ACCOUNT_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com \
       --role roles/iam.workloadIdentityUser \
       --member "serviceAccount:${GCP_PROJECT_ID}.svc.id.goog[${NAMESPACE}/${KUBERNETES_SERVICE_ACCOUNT_NAME}]"
    ```

 6. Add the below config in deployment.yml so that the pod can use the kubernetes service account with workload identity to use kubernetes resources
    ```yaml
    spec:
      serviceAccountName: ${KUBERNETES_SERVICE_ACCOUNT_NAME}
      nodeSelector:
        iam.gke.io/gke-metadata-server-enabled: "true"
    ```

 7. After enabling workload identity federation in GKE you can connect to database without password using the below [instruction](https://github.com/Digital-Innovation-Labs/secrets-rotator/blob/main/docs/db-authentication/iam-database-authentication.md)
 
### Reference

https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity#authenticating_to
