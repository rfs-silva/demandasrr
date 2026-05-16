import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Set python path to /app
sys.path.append("/app")

async def run():
    try:
        from app.repositories.solicitacao_repo import SolicitacaoRepository
        from app.schemas.solicitacao_schema import SolicitacaoFiltros
        from app.core.config import settings

        engine = create_async_engine(settings.DATABASE_URL)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            repo = SolicitacaoRepository(session)
            
            print("Calling top_solicitantes...")
            top = await repo.top_solicitantes(limit=1)
            if not top:
                print("No solicitantes found.")
                return
            
            user = top[0]
            # Handle potential dict or object response from top_solicitantes
            user_id = getattr(user, 'id', None) or (user.get('id') if isinstance(user, dict) else None)
            user_nome = getattr(user, 'nome', None) or (user.get('nome') if isinstance(user, dict) else None)
            
            print(f"Top user: ID={user_id}, Name={user_nome}")
            
            print(f"Calling list_paged for user_id={user_id}...")
            # Ensure we use the correct attribute for filtering
            filtros = SolicitacaoFiltros(usuario_id=user_id)
            result = await repo.list_paged(filtros=filtros, page=1, page_size=5)
            print("list_paged call successful.")
            print(f"Total items: {result.total}")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
