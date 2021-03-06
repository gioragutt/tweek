﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using FSharpUtils.Newtonsoft;
using Tweek.Engine;
using Tweek.Engine.Context;
using Tweek.Engine.Core.Context;
using Tweek.Engine.DataTypes;
using static LanguageExt.Prelude;

namespace Tweek.ApiService.Security
{
    public delegate bool CheckReadConfigurationAccess(ClaimsPrincipal identity, string path, ICollection<Identity> tweekIdentities);
    public delegate bool CheckWriteContextAccess(ClaimsPrincipal identity, Identity tweekIdentity);
    
    public static class Authorization
    {
        public static CheckReadConfigurationAccess CreateReadConfigurationAccessChecker(ITweek tweek, TweekIdentityProvider identityProvider)
        {
            return (identity, path, tweekIdentities) =>
            {
                if (path == "@tweek/_" || path.StartsWith("@tweek/auth")) return false;

                return tweekIdentities
                    .Select(x => x.ToAuthIdentity(identityProvider))
                    .Distinct()
                    .DefaultIfEmpty(Identity.GlobalIdentity)
                    .All(tweekIdentity => CheckAuthenticationForKey(tweek, "read_configuration", identity, tweekIdentity));
            };
        }

        public static bool CheckAuthenticationForKey(ITweek tweek, string permissionType, ClaimsPrincipal identity, Identity tweekIdentity)
        {
            var identityType = tweekIdentity.Type;
            var key = $"@tweek/auth/{identityType}/{permissionType}";

            if (identity.IsTweekIdentity())
            {
                return true;
            }

            var authValues = tweek.Calculate(key, new HashSet<Identity>(),
                type => type == "token"
                    ? (GetContextValue) (q => Optional(identity.FindFirst(q)).Map(x => x.Value).Map(JsonValue.NewString))
                    : _ => None);

            if (!authValues.TryGetValue(key, out var authValue))
            {
                return true;
            }

            if (authValue.Exception != null)
            {
                return false;
            }

            return match(authValue.Value.AsString(),
                with("allow", _ => true),
                with("deny", _ => false),
                claim => Optional(identity.FindFirst(claim))
                    .Match(c => c.Value.Equals(tweekIdentity.Id, StringComparison.OrdinalIgnoreCase), () => false));
        }

        public static CheckWriteContextAccess CreateWriteContextAccessChecker(ITweek tweek, TweekIdentityProvider identityProvider)
        {
            return (identity, tweekIdentity) => CheckAuthenticationForKey(tweek, "write_context", identity, tweekIdentity.ToAuthIdentity(identityProvider));
        }
    }
}
