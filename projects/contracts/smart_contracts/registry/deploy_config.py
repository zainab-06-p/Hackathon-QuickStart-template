"""
Deploy configuration for CampusChain Registry Contract
"""

import logging
import algokit_utils

logger = logging.getLogger(__name__)


def deploy() -> None:
    """Deploy the CampusChain Registry contract to TestNet"""
    from smart_contracts.artifacts.registry.campus_chain_registry_client import CampusChainRegistryFactory

    # Get Algorand client configured for TestNet
    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    logger.info("🚀 Deploying CampusChain Registry Contract to TestNet...")

    factory = algorand.client.get_typed_app_factory(
        CampusChainRegistryFactory, 
        default_sender=deployer.address
    )

    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.ReplaceApp,
        on_schema_break=algokit_utils.OnSchemaBreak.ReplaceApp,
    )

    if result.operation_performed in [
        algokit_utils.OperationPerformed.Create,
        algokit_utils.OperationPerformed.Replace,
    ]:
        logger.info(f"✅ Registry deployed successfully!")
        logger.info(f"📋 Registry App ID: {app_client.app_id}")
        logger.info(f"📍 Registry Address: {app_client.app_address}")
        logger.info(f"")
        logger.info(f"⚠️  IMPORTANT: Add this to your frontend/.env.production file:")
        logger.info(f"   VITE_REGISTRY_APP_ID={app_client.app_id}")
        logger.info(f"")
        logger.info(f"✅ Registry ready! Boxes will be auto-created on first registration.")
