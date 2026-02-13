"""
Deploy configuration for CampusChain Registry Contract
"""

import logging
from algopy_testing import AlgopyTestContext, algopy_testing_context

logger = logging.getLogger(__name__)


# define deployment behaviour based on supplied app spec
def deploy(
    algod_client,
    indexer_client,
    app_spec,
    deployer,
) -> None:
    from smart_contracts.artifacts.registry.contract import (
        CampusChainRegistryClient,
    )

    app_client = CampusChainRegistryClient(
        algod_client,
        creator=deployer,
        indexer_client=indexer_client,
    )

    logger.info("Deploying CampusChain Registry Contract...")

    app_client.deploy(
        on_schema_break=OnSchemaBreak.ReplaceApp,
        on_update=OnUpdate.UpdateApp,
    )

    # Initialize the registry with empty lists
    logger.info("Initializing registry with empty lists...")
    response = app_client.create_registry()
    
    logger.info(f"✅ Registry deployed successfully!")
    logger.info(f"📋 Registry App ID: {app_client.app_id}")
    logger.info(f"⚠️ IMPORTANT: Add this to your .env.production file:")
    logger.info(f"   VITE_REGISTRY_APP_ID={app_client.app_id}")
    
    return app_client.app_id
