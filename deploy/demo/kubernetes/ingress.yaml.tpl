apiVersion: v1
kind: Namespace
metadata:
  name: acornops-mattermost-demo
---
apiVersion: v1
kind: Service
metadata:
  name: mattermost
  namespace: acornops-mattermost-demo
spec:
  ports:
    - name: http
      port: 8065
      protocol: TCP
      targetPort: 8065
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: mattermost
  namespace: acornops-mattermost-demo
  labels:
    kubernetes.io/service-name: mattermost
addressType: IPv4
ports:
  - name: http
    protocol: TCP
    port: 8065
endpoints:
  - addresses:
      - "__DEMO_BACKEND_IP__"
---
apiVersion: v1
kind: Service
metadata:
  name: mattermost-bot
  namespace: acornops-mattermost-demo
spec:
  ports:
    - name: http
      port: 8077
      protocol: TCP
      targetPort: 8077
---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: mattermost-bot
  namespace: acornops-mattermost-demo
  labels:
    kubernetes.io/service-name: mattermost-bot
addressType: IPv4
ports:
  - name: http
    protocol: TCP
    port: 8077
endpoints:
  - addresses:
      - "__DEMO_BACKEND_IP__"
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mattermost
  namespace: acornops-mattermost-demo
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik
  rules:
    - host: mattermost.demo.acornops.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mattermost
                port:
                  name: http
  tls:
    - hosts:
        - mattermost.demo.acornops.dev
      secretName: mattermost-demo-tls
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mattermost-bot
  namespace: acornops-mattermost-demo
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik
  rules:
    - host: mattermost-bot.demo.acornops.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mattermost-bot
                port:
                  name: http
  tls:
    - hosts:
        - mattermost-bot.demo.acornops.dev
      secretName: mattermost-bot-demo-tls
